const jwt = require('jsonwebtoken');
const db = require('../config/database'); // Adjust path as needed

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth check - Token present:', !!token);

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, tokenUser) => {
        if (err) {
            console.error('JWT verify error:', err.message);
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        try {
            console.log('Token verified for user:', tokenUser.id);
            
            // Get fresh user data from database
            const result = await db.query('SELECT id, email, is_admin FROM users WHERE id = $1', [tokenUser.id]);
            
            if (!result.rows[0]) {
                console.log('User not found in database');
                return res.status(404).json({ error: 'User not found' });
            }
            
            console.log('User from DB:', result.rows[0]);
            req.user = result.rows[0];
            next();
        } catch (dbError) {
            console.error('Database error in auth:', dbError);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });
};

const requireAdmin = (req, res, next) => {
    console.log('Admin check for user:', req.user);
    console.log('Is admin:', req.user.is_admin);
    
    if (!req.user || !req.user.is_admin) {
        console.log('Admin access denied');
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    console.log('Admin access granted');
    next();
};

module.exports = { authenticateToken, requireAdmin };
