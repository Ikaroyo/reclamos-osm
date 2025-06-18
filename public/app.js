// Global app functionality

// Function to refresh user data and update UI
async function refreshGlobalUserState() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            localStorage.clear();
            return null;
        }

        const user = await response.json();
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Dispatch event for other components to listen
        window.dispatchEvent(new CustomEvent('userStateChanged', { 
            detail: { user } 
        }));
        
        return user;
    } catch (error) {
        console.error('Error refreshing user state:', error);
        return null;
    }
}

// Auto-refresh user state periodically
if (localStorage.getItem('token')) {
    setInterval(refreshGlobalUserState, 30000); // Every 30 seconds
}
