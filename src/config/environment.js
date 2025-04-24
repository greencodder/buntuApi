require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  sendchamp: {
    publicKey: process.env.SENDCHAMP_PUBLIC_KEY,
    mode: process.env.NODE_ENV === 'production' ? 'live' : 'test'
  }
}; 