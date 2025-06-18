import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isForced, setIsForced] = useState(false)

  useEffect(() => {
    // Check if this is a forced password change
    const checkForcedChange = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.force_password_change === true || 
          user?.user_metadata?.force_password_change === 'true') {
        setIsForced(true)
      }
    }
    
    checkForcedChange()
  }, [])

  const handlePasswordUpdate = async (e: React.FormEvent) => {
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
          force_password_change: false, // Remove the flag
          created_by_admin: undefined // Remove this flag too
        }
      })

      if (error) throw error

      setMessage('Contraseña actualizada correctamente. Redirigiendo...')
      setTimeout(() => {
        window.location.href = '/' // Full page refresh to reset state
      }, 2000)

    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>
          <span className="icon">🔒</span> 
          {isForced ? 'Cambiar Contraseña Requerido' : 'Restablecer Contraseña'}
        </h2>
        
        {isForced ? (
          <p>Debes cambiar tu contraseña temporal antes de continuar usando el sistema.</p>
        ) : (
          <p>Ingresa tu nueva contraseña para completar el proceso de recuperación.</p>
        )}
        
        <form onSubmit={handlePasswordUpdate}>
          <div className="form-group">
            <label><span className="icon">🔑</span> Nueva Contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              placeholder="Mínimo 6 caracteres"
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
              placeholder="Repite la nueva contraseña"
            />
          </div>

          {message && (
            <div className={message.includes('correctamente') ? 'success' : 'error'}>
              {message}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
        
        {isForced && (
          <div className="info-box">
            <p><strong>Nota:</strong> Esta es una contraseña temporal asignada por un administrador. 
            Una vez que la cambies, podrás acceder normalmente al sistema.</p>
          </div>
        )}
      </div>
    </div>
  )
}
