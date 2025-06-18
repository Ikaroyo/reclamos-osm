import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAllTables()
  }, [])

  const checkAllTables = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setDebugInfo({ error: 'No user found' })
        setLoading(false)
        return
      }

      const info: any = {
        userId: user.id,
        email: user.email,
        metadata: user.user_metadata,
        appMetadata: user.app_metadata,
        tables: {}
      }

      // Try different table names
      const tableNames = ['profiles', 'profile', 'users', 'user_profiles']
      
      for (const tableName of tableNames) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', user.id)
            .single()
          
          info.tables[tableName] = {
            success: !error,
            data: data,
            error: error?.message
          }
        } catch (e) {
          info.tables[tableName] = {
            success: false,
            error: 'Table not accessible'
          }
        }
      }

      // Try email lookup
      for (const tableName of tableNames) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('email', user.email)
            .single()
          
          info.tables[`${tableName}_by_email`] = {
            success: !error,
            data: data,
            error: error?.message
          }
        } catch (e) {
          info.tables[`${tableName}_by_email`] = {
            success: false,
            error: 'Email lookup failed'
          }
        }
      }

      setDebugInfo(info)
      setLoading(false)
    } catch (error) {
      setDebugInfo({ error: (error instanceof Error ? error.message : String(error)) })
      setLoading(false)
    }
  }

  if (loading) return <div>Loading debug info...</div>

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      background: '#f0f0f0', 
      padding: '15px', 
      borderRadius: '5px', 
      fontSize: '12px',
      maxWidth: '400px',
      maxHeight: '400px',
      overflow: 'auto',
      border: '1px solid #ccc',
      zIndex: 9999
    }}>
      <h4>Debug Info</h4>
      <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      <button onClick={() => checkAllTables()}>Refresh</button>
    </div>
  )
}
