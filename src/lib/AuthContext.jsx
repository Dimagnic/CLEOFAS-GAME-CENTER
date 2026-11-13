import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabaseClient'

const AuthContext = createContext(null)
const DEMO_KEY = 'cleofas_demo_session'
export const SIN_ACCESO = 'Esta cuenta no tiene acceso al panel. Pide al dueño que la agregue al equipo.'

// ¿El usuario es del equipo? Lo decide la base de datos (tabla "equipo", por correo o user_id).
async function esMiembro() {
  const { data, error } = await supabase.rpc('es_equipo')
  return !error && data === true
}

// Una sola sesión para todos: los socios (clientes) usan /cuenta y el equipo usa /panel.
// Estar conectado NO da acceso al panel: para eso hace falta esEquipo === true.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [esEquipo, setEsEquipo] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (supabaseReady) {
      let vivo = true
      let ultimoUsuario
      const esEquipoRef = { actual: false }
      async function aplicar(s) {
        const uid = s?.user?.id ?? null
        const ok = uid ? (uid === ultimoUsuario ? esEquipoRef.actual : await esMiembro()) : false
        if (!vivo) return
        ultimoUsuario = uid
        esEquipoRef.actual = ok
        setSession(s)
        setEsEquipo(ok)
        setLoading(false)
      }
      supabase.auth.getSession().then(({ data }) => aplicar(data.session))
      const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
        // Supabase pide no hacer otras consultas dentro de este callback.
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

  // Inicio de sesión del PANEL: si la cuenta no es del equipo, se cierra y se avisa.
  async function signIn(email, password) {
    if (supabaseReady) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(traducirError(error))
      if (!(await esMiembro())) {
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

// Mensajes de Supabase Auth en español
export function traducirError(error) {
  const m = String(error?.message || error || '')
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(m)) return 'Aún no activas tu cuenta. Revisa tu correo y abre el enlace de activación.'
  if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.'
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.'
  if (/rate limit|security purposes|too many/i.test(m)) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
  if (/signups not allowed|signup is disabled/i.test(m)) return 'El registro de cuentas está desactivado por el momento.'
  if (/same password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta a la anterior.'
  if (/invalid email|unable to validate email/i.test(m)) return 'Ese correo no parece válido.'
  if (/expired|invalid.*token|otp/i.test(m)) return 'El enlace ya venció o no es válido. Pide uno nuevo.'
  return m || 'Algo salió mal. Intenta de nuevo.'
}
