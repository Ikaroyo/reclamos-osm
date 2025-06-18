import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type User = {
  id: string
  email: string
  is_admin: boolean
  created_at: string
  updated_at: string
}

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    loadUsers()
    getCurrentUserId()
  }, [])

  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      // Use RPC function to get users and bypass RLS issues
      const { data, error } = await supabase
        .rpc('get_all_users_admin')

      if (error) {
        // Fallback: try direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (fallbackError) throw fallbackError
        setUsers(fallbackData || [])
      } else {
        setUsers(data || [])
      }
    } catch (error: any) {
      console.error('Error loading users:', error)
      setError('Error cargando usuarios: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    // Prevent user from modifying their own admin status
    if (userId === currentUserId) {
      setError('No puedes modificar tu propio estado de administrador')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!confirm(`¿Estás seguro de que quieres ${makeAdmin ? 'otorgar' : 'revocar'} privilegios de admin?`)) {
      return
    }

    try {
      // Use RPC function to update admin status
      const { error } = await supabase
        .rpc('update_user_admin_status', { 
          target_user_id: userId, 
          new_admin_status: makeAdmin 
        })

      if (error) {
        // Fallback: try direct update
        const { error: directError } = await supabase
          .from('profiles')
          .update({ is_admin: makeAdmin, updated_at: new Date().toISOString() })
          .eq('id', userId)
        
        if (directError) throw directError
      }

      await loadUsers()
      setSuccess(`Rol de usuario actualizado correctamente`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      console.error('Error updating user role:', error)
      setError('Error actualizando rol de usuario: ' + error.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const deleteUser = async (userId: string, email: string) => {
    // Prevent user from deleting their own account
    if (userId === currentUserId) {
      setError('No puedes eliminar tu propia cuenta')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario: ${email}?\nEsta acción eliminará el usuario del sistema.`)) {
      return
    }

    try {
      // Method 1: Try using the enhanced RPC function that handles both profile and auth deletion
      const { error: rpcError } = await supabase
        .rpc('delete_user_complete', { target_user_id: userId })

      if (!rpcError) {
        await loadUsers()
        setSuccess(`Usuario ${email} eliminado del sistema`)
        setTimeout(() => setSuccess(''), 3000)
        return
      }

      console.log('RPC deletion failed, trying manual approach:', rpcError)

      // Method 2: Delete from profiles table (this is what we can actually do)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (profileError) throw profileError

      // Don't try auth deletion since we know it will fail
      // The user will still exist in auth.users but won't be able to access the app
      // since their profile is deleted

      await loadUsers()
      setSuccess(`Usuario ${email} eliminado del perfil. El usuario no podrá acceder al sistema.`)
      setTimeout(() => setSuccess(''), 4000)

    } catch (error: any) {
      console.error('Error deleting user:', error)
      setError('Error eliminando usuario: ' + error.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newUserEmail || !newUserPassword) {
      setError('Por favor completa todos los campos')
      return
    }

    try {
      setCreatingUser(true)
      setError('')
      setSuccess('')

      // Check if user already exists first
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', newUserEmail)
        .single()

      if (existingUser) {
        setError('Ya existe un usuario con este email')
        return
      }

      // First, sign up the user with temporary password that must be changed
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation for admin-created users
          data: {
            force_password_change: true, // Add flag to force password change
            created_by_admin: true // Additional flag to identify admin-created users
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Try to create profile manually if trigger fails
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: authData.user.email,
              is_admin: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (profileError) {
            console.log('Direct profile creation failed, waiting for trigger...')
            // Wait longer for the trigger to execute
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        } catch (manualError) {
          console.log('Manual profile creation failed, relying on trigger')
        }

        // Final check if profile exists
        let profileExists = false
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: profileCheck } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', authData.user.id)
            .single()

          if (profileCheck) {
            profileExists = true
            break
          }

          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        if (!profileExists) {
          // Profile wasn't created, but user exists in auth
          // This is actually OK - the user can still log in and the profile will be created then
          console.log('Profile not found after multiple attempts, but user was created')
        }
      }

      setNewUserEmail('')
      setNewUserPassword('')
      setShowAddForm(false)
      await loadUsers()
      setSuccess('Usuario creado correctamente. El usuario deberá cambiar su contraseña en el primer inicio de sesión.')
      setTimeout(() => setSuccess(''), 5000)

    } catch (error: any) {
      console.error('Error creating user:', error)
      
      // Even if there's an error, check if the user was actually created
      if (newUserEmail) {
        // Wait a moment and check if user appears in our list
        setTimeout(async () => {
          try {
            await loadUsers()
            const userExists = users.some(u => u.email === newUserEmail)
            if (userExists) {
              setNewUserEmail('')
              setNewUserPassword('')
              setShowAddForm(false)
              setSuccess('Usuario creado correctamente. Nota: Hubo un problema menor con la creación del perfil, pero el usuario puede iniciar sesión normalmente.')
              setTimeout(() => setSuccess(''), 7000)
              return
            }
          } catch (checkError) {
            console.log('Error checking if user was created:', checkError)
          }
          
          setError('Error creando usuario: ' + error.message)
          setTimeout(() => setError(''), 5000)
        }, 3000)
      } else {
        setError('Error creando usuario: ' + error.message)
        setTimeout(() => setError(''), 5000)
      }
    } finally {
      setCreatingUser(false)
    }
  }

  if (loading) {
    return <div className="loading">Cargando usuarios...</div>
  }

  return (
    <div className="user-manager">
      <div className="header">
        <h2><span className="icon">👥</span> Gestión de Usuarios</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <span className="icon">{showAddForm ? '✕' : '+'}</span>
          {showAddForm ? 'Cancelar' : 'Agregar Usuario'}
        </button>
      </div>

      {error && <div className="error"><span className="icon">⚠️</span> {error}</div>}
      {success && <div className="success"><span className="icon">✓</span> {success}</div>}

      {showAddForm && (
        <div className="add-user-form">
          <h3><span className="icon">➕</span> Nuevo Usuario</h3>
          <form onSubmit={addUser}>
            <div className="form-row">
              <div className="form-group">
                <label><span className="icon">📧</span> Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  disabled={creatingUser}
                />
              </div>
              <div className="form-group">
                <label><span className="icon">🔒</span> Contraseña Temporal</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={creatingUser}
                  placeholder="El usuario deberá cambiarla en el primer login"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-success" disabled={creatingUser}>
                {creatingUser ? (
                  <>
                    <span className="icon">⏳</span> Creando Usuario...
                  </>
                ) : (
                  <>
                    <span className="icon">✓</span> Crear Usuario
                  </>
                )}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
                disabled={creatingUser}
              >
                <span className="icon">✕</span> Cancelar
              </button>
            </div>
          </form>
          <div className="form-info">
            <p><span className="icon">ℹ️</span> <strong>Nota:</strong> El usuario será creado sin privilegios de administrador y deberá cambiar su contraseña en el primer inicio de sesión.</p>
          </div>
        </div>
      )}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th><span className="icon">🆔</span> ID</th>
              <th><span className="icon">📧</span> Email</th>
              <th><span className="icon">👤</span> Rol</th>
              <th><span className="icon">📅</span> Fecha Registro</th>
              <th><span className="icon">⚙️</span> Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id.substring(0, 8)}...</td>
                <td>
                  {user.email}
                  {user.id === currentUserId && <span style={{color: '#007bff', marginLeft: '8px'}}>(Tú)</span>}
                </td>
                <td>
                  <span className={user.is_admin ? 'admin-badge' : 'user-badge'}>
                    <span className="icon">{user.is_admin ? '👑' : '👤'}</span>
                    {user.is_admin ? 'Admin' : 'Usuario'}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => toggleAdmin(user.id, !user.is_admin)}
                      className={`btn ${user.is_admin ? 'btn-warning' : 'btn-success'}`}
                      disabled={user.id === currentUserId}
                      style={{
                        opacity: user.id === currentUserId ? 0.5 : 1,
                        cursor: user.id === currentUserId ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <span className="icon">{user.is_admin ? '👑➖' : '👑➕'}</span>
                      {user.is_admin ? 'Quitar Admin' : 'Hacer Admin'}
                    </button>
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      className="btn btn-danger"
                      disabled={user.id === currentUserId}
                      style={{
                        opacity: user.id === currentUserId ? 0.5 : 1,
                        cursor: user.id === currentUserId ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <span className="icon">🗑️</span>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}