import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Distributor = {
  id: number
  calle: string
  repartidor: string
  created_at: string
  updated_at: string
}

export type Complaint = {
  id: number
  mes: number
  año: number
  cuenta: string
  calle: string
  numero: string
  repartidor: string
  observaciones?: string
  entregar: boolean
  emitido: boolean
  enviar_por_mail: boolean
  mail?: string
  telefono?: string
  tomado_por?: string
  user_id: string
  created_at: string
  updated_at: string
}

export const checkIsAdmin = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return false

    // First, try to ensure the user has a profile
    try {
      await supabase.rpc('ensure_user_profile')
    } catch (profileError) {
      console.log('Could not ensure profile exists:', profileError)
    }

    // Method 1: Try using RPC function
    try {
      const { data, error } = await supabase
        .rpc('get_user_admin_status_by_id', { user_id: user.id })
      
      if (!error && data !== null) {
        return Boolean(data)
      }
    } catch (rpcError) {
      console.log('RPC admin check failed:', rpcError)
    }

    // Method 2: Check hardcoded admin emails
    const adminEmails = ['devilbone.skin@gmail.com', 'email1@gmail.com', 'email2@gmail.com']
    if (user.email && adminEmails.includes(user.email)) {
      return true
    }

    // Method 3: Try direct profile query
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!error && profile) {
        return Boolean(profile.is_admin)
      }
    } catch (profileError) {
      console.log('Direct profile query failed:', profileError)
    }

    // Method 4: Check user metadata
    if (user.user_metadata?.is_admin || user.app_metadata?.is_admin) {
      return true
    }

    return false
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}