/**
 * Generates a random reference ID for transactions
 * @returns {string} Reference ID
 */
exports.generateReference = () => {
  const timestamp = new Date().getTime().toString();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `REF-${timestamp}-${random}`;
};

/**
 * Generates a random OTP code
 * @param {number} length - Length of the OTP code (default: 6)
 * @returns {string} OTP code
 */
exports.generateOTP = (length = 6) => {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
};

/**
 * Send OTP via SendChamp SMS service
 * @param {string} phone - Phone number to send OTP to
 * @param {string} code - OTP code
 * @returns {Promise<boolean>} Success status
 */
exports.sendOTP = async (phone, code) => {
  try {
    const sendchamp = require('../config/sendchamp');
    
    // Remove the leading '+' if present in the phone number
    const formattedPhone = phone.startsWith('+') ? phone.substring(1) : phone;
    
    // Send OTP message via SendChamp
    const response = await sendchamp.sms.send({
      to: [formattedPhone],
      message: `Your verification code is: ${code}. Valid for 10 minutes.`,
      sender_name: 'BuntuPay', // Your SendChamp registered sender ID
      route: 'dnd' // Use 'dnd' for messages that should bypass DND
    });
    
    console.log('SendChamp SMS sent:', response.data ? 'success' : 'failed');
    
    return response.data && response.data.status === 'success';
  } catch (error) {
    console.error('SendChamp SMS error:', error.message || error);
    
    // Fallback to console log in case of API failure
    console.log(`[SMS FALLBACK] OTP ${code} for ${phone} - Service unavailable`);
    
    // Return true to not block the flow in development/when API fails
    return process.env.NODE_ENV !== 'production';
  }
};

/**
 * Formats currency amount
 * @param {number} amount - The amount to format
 * @returns {string} Formatted amount
 */
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

/**
 * Handles API error responses
 * @param {Error} error - The error object
 * @param {Response} res - Express response object
 * @returns {Response} Error response
 */
exports.handleApiError = (error, res) => {
  console.error('API Error:', error);
  
  if (error.code === 'P2002') {
    return res.status(409).json({
      message: 'A record with this unique field already exists.'
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      message: 'Record not found.'
    });
  }

  return res.status(500).json({
    message: 'An unexpected error occurred.'
  });
}; 