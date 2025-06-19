import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [message, setMessage] = useState('')
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Check if user needs to change password (admin-created users)
      if (data.user?.user_metadata?.force_password_change === true || 
          data.user?.user_metadata?.force_password_change === 'true') {
        setShowPasswordChange(true)
        return
      }

    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setMessage('Las contraseñas no coinciden')
      return
    }

    if (newPassword.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          force_password_change: false // Remove the flag
        }
      })

      if (error) throw error

      setMessage('Contraseña actualizada correctamente. Redirigiendo...')
      setTimeout(() => {
        window.location.reload() // Refresh to complete the login process
      }, 2000)

    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail)
      if (error) throw error
      
      setMessage('Se ha enviado un enlace de recuperación a tu email')
      setShowResetPassword(false)
      setResetEmail('')
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (showPasswordChange) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2><span className="icon">🔒</span> Cambiar Contraseña</h2>
          <p>Debes cambiar tu contraseña antes de continuar.</p>
          
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label><span className="icon">🔑</span> Nueva Contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label><span className="icon">🔑</span> Confirmar Contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            {message && (
              <div className={message.includes('correctamente') ? 'success' : 'error'}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading}>
              {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (showResetPassword) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2><span className="icon">🔑</span> Recuperar Contraseña</h2>
          
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label><span className="icon">📧</span> Email</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {message && <div className={message.includes('enviado') ? 'success' : 'error'}>{message}</div>}

            <button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
            
            <button 
              type="button" 
              onClick={() => {
                setShowResetPassword(false)
                setMessage('')
                setResetEmail('')
              }}
              className="link-button"
            >
              Volver al login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/reclamos-osm/img/logo.png" alt="Sistema de Reclamos" className="auth-logo-img" />
        </div>
        <h1><span className="icon">📋</span> Sistema de Reclamos</h1>
        <h2>Iniciar Sesión</h2>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label><span className="icon">📧</span> Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label><span className="icon">🔒</span> Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {message && <div className="error">{message}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
          
          <button 
            type="button" 
            onClick={() => setShowResetPassword(true)}
            className="link-button"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      </div>
    </div>
  )
}
