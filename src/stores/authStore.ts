import { create } from 'zustand'
import { pythonServices } from '../services/backendConfig'
import { supabase as supabaseClient } from '../services/supabase/supabase'

const BACKEND_TYPE = import.meta.env.VITE_BACKEND_TYPE || 'supabase'

const supabase = supabaseClient

const LAST_ACTIVITY_KEY = 'arb_last_activity'
const USER_KEY = 'arb_user'
const SESSION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function recordActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
}

function isSessionTimedOut(): boolean {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
  if (!raw) return false
  return Date.now() - parseInt(raw, 10) > SESSION_TIMEOUT_MS
}

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  authMethod: 'demo' | 'supabase' | 'python' | null
  isInitializing: boolean
  setAuth: (user: User, token: string, method: 'demo' | 'supabase' | 'python') => void
  logout: () => void
  recordActivity: () => void
  isSessionTimedOut: () => boolean
  loginWithSupabase: (email: string, password: string) => Promise<void>
  loginWithPython: (email: string, password: string) => Promise<void>
  initializeSupabaseSession: () => Promise<void>
  initializePythonSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  authMethod: null,
  isInitializing: true,
  setAuth: (user, token, method) => set({ user, token, authMethod: method }),
  recordActivity,
  isSessionTimedOut,
  logout: async () => {
    if (get().authMethod === 'supabase' && supabase) {
      await supabase.auth.signOut()
    }
    if (get().authMethod === 'python') {
      localStorage.removeItem('token')
      localStorage.removeItem(USER_KEY)
    }
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    set({ user: null, token: null, authMethod: null })
  },
  loginWithSupabase: async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured')
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // Resolve role from public.users by email (handles seeded users whose
    // Supabase auth user_metadata.role may not be set correctly).
    let role: string = data.user.user_metadata?.role || 'solution_architect'
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('email', data.user.email)
        .maybeSingle()
      if (profile?.role) role = profile.role
    } catch {
      // Keep the user_metadata fallback role
    }

    recordActivity()
    set({
      user: {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
        role,
      },
      token: data.session?.access_token || null,
      authMethod: 'supabase',
    })
  },
  loginWithPython: async (email: string, password: string) => {
    try {
      const data = await pythonServices.api.login(email, password)
      const user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
      }
      recordActivity()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      set({ user, token: data.access_token, authMethod: 'python' })
    } catch (error) {
      throw error
    }
  },
  initializeSupabaseSession: async () => {
    try {
      if (!supabase) return

      if (isSessionTimedOut()) {
        await supabase.auth.signOut()
        localStorage.removeItem(LAST_ACTIVITY_KEY)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        let role: string = session.user.user_metadata?.role || 'solution_architect'
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('email', session.user.email)
            .maybeSingle()
          if (profile?.role) role = profile.role
        } catch {
          // Keep the user_metadata fallback role
        }

        recordActivity()
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            role,
          },
          token: session.access_token || null,
          authMethod: 'supabase',
        })
      }
    } finally {
      set({ isInitializing: false })
    }
  },
  initializePythonSession: async () => {
    try {
      const token = localStorage.getItem('token')
      const userRaw = localStorage.getItem(USER_KEY)

      if (!token || !userRaw) return

      if (isSessionTimedOut()) {
        localStorage.removeItem('token')
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(LAST_ACTIVITY_KEY)
        return
      }

      const user = JSON.parse(userRaw) as { id: string; email: string; name: string; role: string }
      recordActivity()
      set({ user, token, authMethod: 'python' })
    } finally {
      set({ isInitializing: false })
    }
  },
}))

// Unified login function that uses the configured backend
export const login = async (email: string, password: string) => {
  const authStore = useAuthStore.getState()
  
  if (BACKEND_TYPE === 'python') {
    return await authStore.loginWithPython(email, password)
  } else {
    return await authStore.loginWithSupabase(email, password)
  }
}

// Unified session initialization
export const initializeSession = async () => {
  const authStore = useAuthStore.getState()
  
  if (BACKEND_TYPE === 'python') {
    return await authStore.initializePythonSession()
  } else {
    return await authStore.initializeSupabaseSession()
  }
}
