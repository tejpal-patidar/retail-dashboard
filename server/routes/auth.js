const express = require('express');
const router = express.Router();
const { registerStore, login, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

// Public routes — apply strict rate limiter to prevent brute-force
router.post('/register-store', authLimiter, registerStore);
router.post('/login', authLimiter, login);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

// NOTE: POST /api/auth/register has been permanently removed.
// It allowed unauthenticated clients to create users with arbitrary roles.
// Staff creation is handled via POST /api/staff (requires authentication + role check).

module.exports = router;
