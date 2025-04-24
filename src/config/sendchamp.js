const { Sendchamp } = require('sendchamp');

// Initialize Sendchamp with API key
const sendchamp = new Sendchamp({
  publicKey: process.env.SENDCHAMP_PUBLIC_KEY,
  mode: process.env.NODE_ENV === 'production' ? 'live' : 'test'
});

module.exports = sendchamp;
