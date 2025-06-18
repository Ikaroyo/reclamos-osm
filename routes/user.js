const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
    // req.user already contains fresh data from database thanks to updated middleware
    res.json({
        id: req.user.id,
        email: req.user.email,
        is_admin: req.user.is_admin
    });
});

module.exports = router;
