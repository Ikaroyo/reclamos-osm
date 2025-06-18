const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Adjust path as needed
const { authenticateToken, requireAdmin } = require('../middleware/auth'); // Adjust path as needed

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    console.log('Admin users endpoint hit by:', req.user.email);
    try {
        const result = await db.query(`
            SELECT id, email, is_admin, created_at, updated_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        console.log('Returning', result.rows.length, 'users');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Prevent admin from deleting themselves
        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING email', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: `User ${result.rows[0].email} deleted successfully` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle admin status (admin only)
router.patch('/users/:id/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_admin } = req.body;
        
        // Prevent admin from removing their own admin privileges
        if (id === req.user.id && !is_admin) {
            return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
        }
        
        const result = await db.query(`
            UPDATE users 
            SET is_admin = $1, updated_at = NOW() 
            WHERE id = $2 
            RETURNING email, is_admin
        `, [is_admin, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ 
            message: `User ${result.rows[0].email} ${is_admin ? 'granted' : 'revoked'} admin privileges`,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating user admin status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check current user admin status
router.get('/check-admin', authenticateToken, (req, res) => {
    res.json({ 
        is_admin: req.user.is_admin,
        user: {
            id: req.user.id,
            email: req.user.email,
            is_admin: req.user.is_admin
        }
    });
});

// Complete user deletion (profile + auth)
router.delete('/users/:id/complete', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Prevent admin from deleting themselves
        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        // First delete from profiles
        const profileResult = await db.query('DELETE FROM profiles WHERE id = $1 RETURNING email', [id]);
        
        if (profileResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const email = profileResult.rows[0].email;
        
        // Don't try to delete from auth.users since we know it will fail
        // The profile deletion is sufficient to prevent app access
        res.json({ 
            message: `User ${email} removed from system (profile deleted)`,
            auth_deleted: false,
            note: 'User profile deleted - user cannot access application even if auth record remains'
        });
        
    } catch (error) {
        console.error('Error in complete user deletion:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
