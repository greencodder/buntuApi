const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOTP } = require('../utils/helpers');
const smsService = require('../services/smsService');

const prisma = new PrismaClient();

// Register a new user
exports.register = async (req, res) => {
  try {
    const { phone, password, name, email } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    // Validate phone number
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user transaction
    const user = await prisma.$transaction(async (prisma) => {
      // Create user
      const newUser = await prisma.user.create({
        data: {
          phone,
          password: hashedPassword,
          name,
          email
        }
      });

      // Create wallet for user
      await prisma.wallet.create({
        data: {
          userId: newUser.id,
          balance: 0
        }
      });

      return newUser;
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Return user and token (exclude password)
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { phone }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Return user and token (exclude password)
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Check if a phone number exists and handle device verification
 */
exports.checkPhone = async (req, res) => {
  try {
    const { phone, deviceId } = req.body;

    if (!phone || !deviceId) {
      return res.status(400).json({ message: 'Phone number and device ID are required' });
    }

    // Validate phone number
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        devices: true
      }
    });

    // Case 1: User doesn't exist
    if (!user) {
      // Generate and send OTP
      const otpResult = await smsService.generateAndSendOTP(phone, 'REGISTRATION');
      const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes expiry

      // Store OTP
      await prisma.oTP.create({
        data: {
          phone,
          code: otpResult.code,
          purpose: 'REGISTRATION',
          expiresAt
        }
      });

      return res.status(200).json({
        status: 203, // Custom status in response body
        message: 'OTP sent for new registration',
        action: 'REGISTER',
        sent: otpResult.sent
      });
    }

    // Find current device and any active devices
    const currentDevice = user.devices.find(device => device.deviceId === deviceId);
    const activeDevice = user.devices.find(device => device.isActive);
    
    // Case 2: Current device exists and is active
    if (currentDevice && currentDevice.isActive) {
      // Update last login time
      await prisma.device.update({
        where: { id: currentDevice.id },
        data: { lastLogin: new Date() }
      });
      
      return res.status(200).json({
        status: 200,
        message: 'Device recognized',
        action: 'LOGIN',
        userId: user.id
      });
    }
    
    // Case 2.5: Current device exists but is inactive, or there's another active device
    // Either way, we need to send OTP for verification

    // Generate and send OTP for device verification
    const otpResult = await smsService.generateAndSendOTP(phone, 'DEVICE_VERIFICATION');
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes expiry

    // Store OTP
    await prisma.oTP.create({
      data: {
        phone,
        code: otpResult.code,
        purpose: 'DEVICE_VERIFICATION',
        userId: user.id,
        expiresAt
      }
    });
    
    // Determine the scenario for the response message
    let message = 'OTP sent for device verification';
    if (currentDevice && !currentDevice.isActive) {
      message = 'Device is inactive. OTP sent for verification.';
    } else if (activeDevice && activeDevice.deviceId !== deviceId) {
      message = 'Another device is active. OTP sent for verification.';
    } else {
      message = 'New device detected. OTP sent for verification.';
    }

    return res.status(200).json({
      status: 202,
      message,
      action: 'VERIFY_DEVICE',
      userId: user.id,
      hasActiveDevice: !!activeDevice,
      sent: otpResult.sent
    });

  } catch (error) {
    console.error('Phone check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Verify OTP code
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, code, deviceId, purpose } = req.body;

    if (!phone || !code || !deviceId) {
      return res.status(400).json({ message: 'Phone, code, and device ID are required' });
    }

    // Find the most recent non-verified OTP for this phone number and purpose
    const otp = await prisma.oTP.findFirst({
      where: {
        phone,
        isVerified: false,
        purpose: purpose || { in: ['REGISTRATION', 'DEVICE_VERIFICATION', 'LOGIN'] },
        expiresAt: { gt: new Date() } // Not expired
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Verify the code
    if (otp.code !== code) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    // Mark OTP as verified
    await prisma.oTP.update({
      where: {
        id: otp.id
      },
      data: {
        isVerified: true
      }
    });

    // Handle different verification scenarios
    if (otp.purpose === 'REGISTRATION') {
      // For registration, just return success - actual registration will happen in another request
      return res.status(200).json({
        message: 'OTP verified successfully',
        action: 'PROCEED_WITH_REGISTRATION'
      });
      
    } else if (otp.purpose === 'DEVICE_VERIFICATION') {
      // For device verification, register the new device
      if (!otp.userId) {
        return res.status(400).json({ message: 'Cannot verify device: User not found' });
      }

      // Implement transaction to handle device status changes
      await prisma.$transaction(async (prisma) => {
        // 1. Find and deactivate any currently active devices for this user
        await prisma.device.updateMany({
          where: {
            userId: otp.userId,
            isActive: true
          },
          data: {
            isActive: false
          }
        });

        // 2. Check if this device already exists but is inactive
        const existingDevice = await prisma.device.findFirst({
          where: {
            userId: otp.userId,
            deviceId: deviceId
          }
        });

        if (existingDevice) {
          // Reactivate the existing device
          await prisma.device.update({
            where: {
              id: existingDevice.id
            },
            data: {
              isActive: true,
              lastLogin: new Date()
            }
          });
        } else {
          // Add the new device as the only active one
          await prisma.device.create({
            data: {
              deviceId,
              userId: otp.userId,
              isActive: true
            }
          });
        }
      });

      // Generate JWT
      const user = await prisma.user.findUnique({
        where: { id: otp.userId }
      });

      const token = jwt.sign(
        { id: user.id, phone: user.phone },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      // Return user and token (exclude password)
      const { password: _, ...userWithoutPassword } = user;
      
      return res.status(200).json({
        message: 'Device verified successfully',
        user: userWithoutPassword,
        token
      });
    }

    // Generic success response for other purposes
    return res.status(200).json({
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 