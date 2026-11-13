import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabaseClient'

const AuthContext = createContext(null)
const DEMO_KEY = 'cleofas_demo_session'
export const SIN_ACCESO = 'Esta cuenta no tiene acceso al panel. Pide al dueño que la agregue al equipo.'

// ¿El usuario está en la tabla "equipo"? Por RLS, solo un miembro puede ver su propia fila.
async function esMiembro(userId) {
  if (!userId) return false
  const { data, error } = await supabase.from('equipo').select('user_id').eq('user_id', userId).maybeSingle()
  return !error && Boolean(data)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [esEquipo, setEsEquipo] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (supabaseReady) {
      let vivo = true
      async function aplicar(s) {
        const ok = s ? await esMiembro(s.user?.id) : false
        if (!vivo) return
        if (s && !ok) {
          // Cuenta válida en Supabase pero sin permiso: se cierra la sesión.
          await supabase.auth.signOut()
          setSession(null)
          setEsEquipo(false)
        } else {
          setSession(s)
          setEsEquipo(ok)
        }
        setLoading(false)
      }
      supabase.auth.getSession().then(({ data }) => aplicar(data.session))
      const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
        // Renovar el token no cambia al usuario: no hace falta volver a consultar.
        if (evento === 'TOKEN_REFRESHED') { setSession(s); return }
        // Supabase pide no esperar otras consultas dentro de este callback.
        setTimeout(() => aplicar(s), 0)
      })
      return () => { vivo = false; sub.subscription.unsubscribe() }
    }
    // Modo demo sin Supabase: la sesión vive solo en este navegador.
    const demo = Boolean(sessionStorage.getItem(DEMO_KEY))
    setSession(demo ? { demo: true } : null)
    setEsEquipo(demo)
    setLoading(false)
  }, [])

  async function signIn(email, password) {
    if (supabaseReady) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!(await esMiembro(data.user?.id))) {
        await supabase.auth.signOut()
        throw new Error(SIN_ACCESO)
      }
      setSession(data.session)
      setEsEquipo(true)
      return
    }
    // Demo: cualquier correo con la contraseña "cleofas2026" entra al panel.
    if (password !== 'cleofas2026') throw new Error('Contraseña incorrecta (demo: cleofas2026)')
    sessionStorage.setItem(DEMO_KEY, '1')
    setSession({ demo: true })
    setEsEquipo(true)
  }

  async function signOut() {
    if (supabaseReady) await supabase.auth.signOut()
    sessionStorage.removeItem(DEMO_KEY)
    setSession(null)
    setEsEquipo(false)
  }

  return (
    <AuthContext.Provider value={{ session, esEquipo, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
