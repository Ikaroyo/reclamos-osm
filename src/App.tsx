import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import ResetPassword from './components/ResetPassword'
import ComplaintForm from './components/ComplaintForm'
import Statistics from './components/Statistics'
import DistributorManager from './components/DistributorManager'
import ComplaintsList from './components/ComplaintsList'
import UserManager from './components/UserManager'
import './App.css'

type User = any

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('complaints')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [adminChecked, setAdminChecked] = useState(false) // Add this to track if admin status was checked

  useEffect(() => {
    // Check if this is a password reset flow
    const urlParams = new URLSearchParams(window.location.search)
    const isPasswordReset = urlParams.get('type') === 'recovery'
    
    if (isPasswordReset) {
      setShowResetPassword(true)
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setUser(user)
      
      // Check if user needs to change password after email confirmation
      if (user?.user_metadata?.force_password_change === true || 
          user?.user_metadata?.force_password_change === 'true') {
        setShowResetPassword(true) // Use the same component for forced password change
      }
      
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null
      const previousUser = user
      
      console.log('Auth state change:', event, 'Previous user:', previousUser?.id, 'New user:', newUser?.id)
      
      // Check for forced password change after any auth event
      if (newUser?.user_metadata?.force_password_change === true || 
          newUser?.user_metadata?.force_password_change === 'true') {
        setShowResetPassword(true)
        setUser(newUser)
        return
      }
      
      // Only reset admin status if the user actually changed (not just session refresh)
      if (previousUser?.id !== newUser?.id) {
        console.log('User actually changed, resetting admin status')
        setUser(newUser)
        setIsAdmin(false)
        setAdminChecked(false)
      } else if (newUser && previousUser?.id === newUser?.id) {
        // Same user, just update the user object but keep admin status
        console.log('Same user, keeping admin status')
        setUser(newUser)
      }
      
      // Handle password recovery flow
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [user?.id]) // Add user.id as dependency to track user changes

  useEffect(() => {
    // Only check admin status if user exists and we haven't checked yet
    if (user && !adminChecked) {
      checkAdminStatus()
    }
  }, [user, adminChecked])

  const checkAdminStatus = async () => {
    try {
      console.log('Checking admin status for user:', user?.email)
      
      // Force a fresh check by bypassing any cache
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (currentUser) {
        console.log('Current user ID:', currentUser.id)
        console.log('Current user email:', currentUser.email)
        
        // Method 1: Try using RPC function that bypasses RLS
        try {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_user_admin_status', { user_email: currentUser.email })
          
          if (!rpcError && rpcData !== null) {
            console.log('Admin from RPC function:', rpcData)
            setIsAdmin(Boolean(rpcData))
            setAdminChecked(true)
            return
          }
        } catch (rpcError) {
          console.log('RPC function not available:', rpcError)
        }
        
        // Method 2: Direct email check (hardcoded admin emails)
        const adminEmails = ['devilbone.skin@gmail.com', 'email1@gmail.com', 'email2@gmail.com']
        const adminFromEmail = adminEmails.includes(currentUser.email || '')
        console.log('Admin from email check:', adminFromEmail, 'Email:', currentUser.email)
        
        if (adminFromEmail) {
          setIsAdmin(true)
          setAdminChecked(true)
          return
        }
        
        // Method 3: Check user metadata
        const adminFromMetadata = Boolean(
          currentUser.user_metadata?.is_admin || 
          currentUser.app_metadata?.is_admin
        )
        console.log('Admin from metadata:', adminFromMetadata)
        
        if (adminFromMetadata) {
          setIsAdmin(true)
          setAdminChecked(true)
          return
        }
        
        // Method 4: Try to query profiles with specific user context
        try {
          // Use the authenticated user's session to query their own profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('email', currentUser.email)
            .limit(1)
            .maybeSingle()
          
          if (!profileError && profileData) {
            console.log('Profile data found:', profileData)
            setIsAdmin(Boolean(profileData.is_admin))
            setAdminChecked(true)
            return
          }
        } catch (profileError) {
          console.log('Profile query failed:', profileError)
        }
      }
      
      console.log('No admin status found, setting to false')
      setIsAdmin(false)
      setAdminChecked(true)
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
      setAdminChecked(true)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsAdmin(false)
    setAdminChecked(false)
    setActiveTab('complaints')
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleTabClick = (tab: string) => {
    setActiveTab(tab)
    setIsMobileMenuOpen(false) // Close menu after selection
  }

  if (loading) {
    return <div className="loading">Cargando...</div>
  }

  if (showResetPassword) {
    return <ResetPassword />
  }

  if (!user) {
    return <Auth />
  }

  console.log('Rendering App - User:', user?.email, 'IsAdmin:', isAdmin)

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <img src="/img/logo.png" alt="Logo" className="nav-logo" />
          <h1>Sistema de Reclamos</h1>
          {isAdmin && <span className="admin-badge">Admin</span>}
        </div>

        {/* Burger menu button */}
        <button 
          className={`burger-menu ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <button 
            className={activeTab === 'complaints' ? 'active' : ''}
            onClick={() => handleTabClick('complaints')}
          >
            <span className="icon">📄</span>
            <span className="nav-text">Nuevo Reclamo</span>
          </button>
          <button 
            className={activeTab === 'list' ? 'active' : ''}
            onClick={() => handleTabClick('list')}
          >
            <span className="icon">📋</span>
            <span className="nav-text">Lista</span>
          </button>
          <button 
            className={activeTab === 'statistics' ? 'active' : ''}
            onClick={() => handleTabClick('statistics')}
          >
            <span className="icon">📊</span>
            <span className="nav-text">Estadísticas</span>
          </button>
          {isAdmin && (
            <>
              <button 
                className={activeTab === 'distributors' ? 'active' : ''}
                onClick={() => handleTabClick('distributors')}
              >
                <span className="icon">👥</span>
                <span className="nav-text">Repartidores</span>
              </button>
              <button 
                className={activeTab === 'users' ? 'active' : ''}
                onClick={() => handleTabClick('users')}
              >
                <span className="icon">⚙️</span>
                <span className="nav-text">Usuarios</span>
              </button>
            </>
          )}
          <button className="logout-button" onClick={handleSignOut}>
            <span className="icon">→</span>
            <span className="nav-text">Cerrar Sesión</span>
          </button>
        </div>

        {/* Overlay for mobile menu */}
        {isMobileMenuOpen && (
          <div 
            className="nav-overlay" 
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
        )}
      </nav>

      {/* Floating user info in bottom right */}
      <div className="floating-user-info">
        <div className="user-avatar">
          <span className="user-initial">{user?.email?.charAt(0).toUpperCase()}</span>
          {isAdmin && <span className="admin-crown">👑</span>}
        </div>
        <div className="user-tooltip">
          <span className="user-email">{user?.email}</span>
          {isAdmin && <span className="admin-text">Administrador</span>}
        </div>
      </div>

      <main className="main-content">
        {activeTab === 'complaints' && <ComplaintForm />}
        {activeTab === 'list' && <ComplaintsList />}
        {activeTab === 'statistics' && <Statistics />}
        {activeTab === 'distributors' && isAdmin && <DistributorManager />}
        {activeTab === 'users' && isAdmin && <UserManager />}
      </main>
    </div>
  )
}