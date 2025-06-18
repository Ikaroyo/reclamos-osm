async function login(email, password) {
    try {
        // Clear any existing data
        localStorage.clear();
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('Invalid credentials');
        }

        const data = await response.json();
        
        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Dispatch custom event to notify other parts of the app
        window.dispatchEvent(new CustomEvent('userLoggedIn', { 
            detail: { user: data.user } 
        }));
        
        // Force complete page reload to refresh all content
        setTimeout(() => {
            if (data.user.is_admin) {
                window.location.href = '/admin';
            } else {
                window.location.href = '/dashboard';
            }
            // Force reload after navigation
            setTimeout(() => window.location.reload(), 100);
        }, 100);
        
    } catch (error) {
        showError('Login failed: ' + error.message);
    }
}

async function fetchCurrentUser() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const user = await response.json();
            localStorage.setItem('currentUser', JSON.stringify(user));
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}