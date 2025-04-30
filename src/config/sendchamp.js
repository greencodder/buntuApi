const axios = require('axios');

class CustomSendchamp {
  constructor(config) {
    this.publicKey = config.publicKey;
    this.mode = config.mode || 'test';
    this.baseURL = this.mode === 'live' 
      ? 'https://api.sendchamp.com/api/v1' 
      : 'https://sandbox-api.sendchamp.com/api/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.publicKey}`
      }
    });
  }

  async sms(options) {
    try {
      const response = await this.client.post('/sms/send', {
        to: options.to,
        message: options.message,
        sender_name: options.sender_name,
        route: options.route || 'dnd'
      });

      return {
        data: response.data
      };
    } catch (error) {
      console.error('Sendchamp API Error:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Initialize Sendchamp with API key
const sendchamp = new CustomSendchamp({
  publicKey: process.env.SENDCHAMP_PUBLIC_KEY,
  mode: process.env.NODE_ENV === 'production' ? 'live' : 'test'
});

module.exports = sendchamp;
