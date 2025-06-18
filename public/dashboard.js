document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    
    loadUserProfile();
});

async function loadUserProfile() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load profile');
        }

        const user = await response.json();
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Update UI based on current user status
        displayUserInfo(user);
        
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function displayUserInfo(user) {
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement) {
        userInfoElement.innerHTML = `
            <h2>Welcome, ${user.email}</h2>
            <p>Role: ${user.is_admin ? 'Administrator' : 'User'}</p>
            ${user.is_admin ? '<a href="/admin" class="btn btn-primary">Admin Panel</a>' : ''}
        `;
    }
}

function logout() {
    localStorage.clear();
    window.location.href = '/login';
}
