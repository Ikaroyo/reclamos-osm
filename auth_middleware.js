const checkAdminRole = async (req, res, next) => {
    try {
        const userId = req.user.id; // Asume que el usuario está en req.user
        
        // Consulta fresca a la base de datos para obtener el estado actual
        const user = await db.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
        
        if (!user.rows[0] || !user.rows[0].is_admin) {
            return res.status(403).json({ 
                error: 'Access denied. Admin privileges required.' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Error checking admin role:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { checkAdminRole };
