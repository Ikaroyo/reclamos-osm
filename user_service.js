const getUserWithRoles = async (userId) => {
    const query = `
        SELECT id, email, is_admin, created_at, updated_at 
        FROM users 
        WHERE id = $1
    `;
    
    const result = await db.query(query, [userId]);
    
    if (!result.rows[0]) {
        throw new Error('User not found');
    }
    
    return {
        ...result.rows[0],
        // Asegurar que is_admin sea booleano
        is_admin: Boolean(result.rows[0].is_admin)
    };
};

const updateUserAdminStatus = async (userId, isAdmin) => {
    const query = `
        UPDATE users 
        SET is_admin = $1, updated_at = NOW() 
        WHERE id = $2 
        RETURNING *
    `;
    
    const result = await db.query(query, [isAdmin, userId]);
    return result.rows[0];
};

module.exports = { getUserWithRoles, updateUserAdminStatus };
