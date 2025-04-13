const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// Get user profile route (protected)
router.get('/profile', authMiddleware, userController.getProfile);

module.exports = router; 