/**
 * SMS Service for handling OTP and notification messages
 * Using SendChamp API
 */

const sendchamp = require('../config/sendchamp');
const { generateOTP } = require('../utils/helpers');

/**
 * Send SMS notification
 * @param {string} phone - Phone number to send SMS to
 * @param {string} message - Message content
 * @param {string} senderName - Sender ID (registered with SendChamp)
 * @returns {Promise<object>} SendChamp response
 */
const sendSMS = async (phone, message, senderName = 'KEFAS') => {
  try {
    // Remove the leading '+' if present in the phone number
    const formattedPhone = phone.startsWith('+') ? phone.substring(1) : phone;
    
    // Send SMS via SendChamp
    const response = await sendchamp.sms.send({
      to: [formattedPhone],
      message,
      sender_name: senderName,
      route: 'dnd'
    });
    
    return {
      success: response.data && response.data.status === 'success',
      messageId: response.data?.message_id || null,
      response: response.data
    };
  } catch (error) {
    console.error('SendChamp SMS error:', error.message || error);
    return {
      success: false,
      error: error.message || 'Failed to send SMS'
    };
  }
};

/**
 * Send OTP via SMS
 * @param {string} phone - Phone number to send OTP to
 * @param {string} code - OTP code
 * @param {string} purpose - Purpose (registration, login, etc.)
 * @returns {Promise<object>} SendChamp response
 */
const sendOTP = async (phone, code, purpose = 'verification') => {
  // Construct a friendly message based on purpose
  let message;
  switch (purpose) {
    case 'REGISTRATION':
      message = `Welcome! Your verification code for registration is: ${code}. Valid for 10 minutes.`;
      break;
    case 'LOGIN':
      message = `Your login verification code is: ${code}. Valid for 10 minutes.`;
      break;
    case 'DEVICE_VERIFICATION':
      message = `New device detected. Your device verification code is: ${code}. Valid for 10 minutes.`;
      break;
    default:
      message = `Your verification code is: ${code}. Valid for 10 minutes.`;
  }
  
  // Send SMS with the appropriate message
  const result = await sendSMS(phone, message);
  
  // Also log as fallback in development
  if (!result.success && process.env.NODE_ENV !== 'production') {
    console.log(`[SMS FALLBACK] ${message} (to: ${phone})`);
    return {
      success: true,
      fallback: true,
      messageId: null
    };
  }
  
  return result;
};

/**
 * Generate and send a new OTP
 * @param {string} phone - Phone number to send OTP to
 * @param {string} purpose - Purpose of the OTP
 * @param {number} length - Length of OTP code
 * @returns {Promise<object>} OTP details
 */
const generateAndSendOTP = async (phone, purpose, length = 6) => {
  const code = generateOTP(length);
  const smsResult = await sendOTP(phone, code, purpose);
  
  return {
    code,
    sent: smsResult.success,
    messageId: smsResult.messageId,
    fallback: smsResult.fallback || false
  };
};

module.exports = {
  sendSMS,
  sendOTP,
  generateAndSendOTP
};
