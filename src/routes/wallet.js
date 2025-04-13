const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/auth');

// Get wallet balance route (protected)
router.get('/balance', authMiddleware, walletController.getBalance);

// Fund wallet route (protected)
router.post('/fund', authMiddleware, walletController.fundWallet);

module.exports = router; 