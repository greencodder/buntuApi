const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/auth');

// Transfer funds route (protected)
router.post('/transfer', authMiddleware, transactionController.transferFunds);

// Get transaction history route (protected)
router.get('/history', authMiddleware, transactionController.getTransactionHistory);

module.exports = router; 