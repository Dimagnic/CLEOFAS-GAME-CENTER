import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabaseClient'

const AuthContext = createContext(null)
const DEMO_KEY = 'cleofas_demo_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (supabaseReady) {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session)
        setLoading(false)
      })
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
      return () => sub.subscription.unsubscribe()
    }
    // Modo demo sin Supabase: la sesión vive solo en este navegador.
    setSession(sessionStorage.getItem(DEMO_KEY) ? { demo: true } : null)
    setLoading(false)
  }, [])

  async function signIn(email, password) {
    if (supabaseReady) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return
    }
    // Demo: cualquier correo con la contraseña "cleofas2026" entra al panel.
    if (password !== 'cleofas2026') throw new Error('Contraseña incorrecta (demo: cleofas2026)')
    sessionStorage.setItem(DEMO_KEY, '1')
    setSession({ demo: true })
  }

  async function signOut() {
    if (supabaseReady) await supabase.auth.signOut()
    sessionStorage.removeItem(DEMO_KEY)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
