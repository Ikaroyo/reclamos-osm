document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel DOM loaded');
    
    const token = localStorage.getItem('token');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    console.log('Current user from localStorage:', currentUser);
    
    if (!currentUser.is_admin) {
        console.log('User is not admin according to localStorage');
        // Double-check with server
        verifyAdminStatus().then(isAdmin => {
            if (isAdmin) {
                loadUsers();
            } else {
                alert('Access denied. Admin privileges required.');
                window.location.replace('/dashboard');
            }
        });
    } else {
        console.log('User is admin, loading users');
        loadUsers();
    }
});

async function verifyAdminStatus() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.log('Profile check failed:', response.status);
            return false;
        }

        const user = await response.json();
        console.log('Fresh user data from server:', user);
        
        // Update localStorage with fresh data
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        return user.is_admin;
    } catch (error) {
        console.error('Error verifying admin status:', error);
        return false;
    }
}

async function loadUsers() {
    console.log('Loading users...');
    const loading = document.getElementById('loading');
    const table = document.getElementById('usersTable');
    const errorDiv = document.getElementById('error');
    
    try {
        const token = localStorage.getItem('token');
        console.log('Making request to /api/admin/users with token');
        
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Admin users response:', response.status, response.statusText);

        if (response.status === 401) {
            console.log('Unauthorized - clearing storage');
            localStorage.clear();
            window.location.replace('/login');
            return;
        }

        if (response.status === 403) {
            console.log('Forbidden - not admin');
            const errorText = await response.text();
            console.log('Error details:', errorText);
            alert('Access denied. Admin privileges required.');
            window.location.replace('/dashboard');
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const users = await response.json();
        console.log('Users loaded successfully:', users.length);
        
        loading.style.display = 'none';
        table.style.display = 'table';
        displayUsers(users);
        
    } catch (error) {
        console.error('Error loading users:', error);
        loading.style.display = 'none';
        errorDiv.textContent = 'Error loading users: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

function displayUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    const loading = document.getElementById('loading');
    const table = document.getElementById('usersTable');

    loading.style.display = 'none';
    table.style.display = 'table';

    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.email}</td>
            <td>
                <span class="${user.is_admin ? 'admin-badge' : 'user-badge'}">
                    ${user.is_admin ? 'Admin' : 'User'}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>${new Date(user.updated_at).toLocaleDateString()}</td>
            <td>
                <button onclick="toggleAdmin('${user.id}', ${!user.is_admin})" 
                        class="btn ${user.is_admin ? 'btn-warning' : 'btn-success'}">
                    ${user.is_admin ? 'Remove Admin' : 'Make Admin'}
                </button>
                <button onclick="deleteUser('${user.id}', '${user.email}')" 
                        class="btn btn-danger">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

async function toggleAdmin(userId, makeAdmin) {
    if (!confirm(`Are you sure you want to ${makeAdmin ? 'grant' : 'revoke'} admin privileges?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}/admin`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ is_admin: makeAdmin })
        });

        if (!response.ok) {
            throw new Error('Failed to update user role');
        }

        // Immediately refresh the users table to show updated badges
        await loadUsers();
        
        // Also refresh current user data in case they changed their own status
        await refreshUserData();
        
        showSuccess(`User role updated successfully`);
    } catch (error) {
        showError('Error updating user role: ' + error.message);
    }
}

// Add function to refresh user session if they changed their own admin status
async function refreshUserSession() {
    try {
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentUserId = payload.id;
        
        // Check if current user's admin status changed
        const response = await fetch('/api/admin/check-admin', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (!data.is_admin) {
                alert('Your admin privileges have been revoked. Redirecting...');
                localStorage.removeItem('token');
                window.location.href = '/';
            }
        }
    } catch (error) {
        console.error('Error refreshing session:', error);
    }
}

async function deleteUser(userId, email) {
    if (!confirm(`Are you sure you want to delete user: ${email}?\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete user');
        }

        loadUsers(); // Reload the table
        showSuccess(`User ${email} deleted successfully`);
    } catch (error) {
        showError('Error deleting user: ' + error.message);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showSuccess(message) {
    // Create temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.color = 'green';
    successDiv.style.padding = '10px';
    successDiv.style.marginBottom = '10px';
    successDiv.textContent = message;
    
    document.querySelector('.container').insertBefore(successDiv, document.getElementById('loading'));
    setTimeout(() => successDiv.remove(), 3000);
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
}
