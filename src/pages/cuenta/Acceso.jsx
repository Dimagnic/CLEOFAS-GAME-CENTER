import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useAuth, traducirError } from '../../lib/AuthContext'
import FondoVideo from '../../components/FondoVideo'
import Particulas from '../../components/Particulas'
import '../admin/admin.css'
import './cuenta.css'

const origen = () => window.location.origin

// Si un enlace del correo venció, Supabase regresa con #error_description=... en la URL.
export function errorDeUrl() {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const q = new URLSearchParams(window.location.search)
  const d = h.get('error_description') || q.get('error_description')
  return d ? traducirError(d.replace(/\+/g, ' ')) : ''
}

function Tarjeta({ eyebrow, titulo, sub, children }) {
  return (
    <div className="admin-login cuenta-acceso">
      <FondoVideo posicion="50% 40%" />
      <Particulas />
      <Link to="/" className="admin-login__back"><span aria-hidden="true">&larr;</span> Volver al sitio</Link>
      <div className="admin-login__card cuenta-acceso__card">
        <div className="admin-login__escudo">
          <img src="/logo.jpg" alt="Cleofas Game Center" className="admin-login__logo" />
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{titulo}</h1>
        {sub && <p className="admin-login__sub">{sub}</p>}
        {children}
      </div>
    </div>
  )
}

function CampoClave({ name = 'password', placeholder = '********', autoComplete = 'current-password', minLength }) {
  const [ver, setVer] = useState(false)
  return (
    <span className="admin-login__campo">
      <input name={name} type={ver ? 'text' : 'password'} required placeholder={placeholder} autoComplete={autoComplete} minLength={minLength} />
      <button type="button" className="admin-login__ver" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? 'Ocultar' : 'Ver'}</button>
    </span>
  )
}

function SinSupabase() {
  return <p className="admin-login__error">Las cuentas de socio necesitan Supabase conectado.</p>
}

export function Entrar() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState(() => location.state?.error || errorDeUrl())
  const [enviando, setEnviando] = useState(false)
  const aviso = location.state?.aviso

  if (!loading && session && !session.demo) return <Navigate to="/cuenta" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const f = new FormData(e.target)
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: f.get('password') })
    setEnviando(false)
    if (error) setError(traducirError(error))
    else navigate('/cuenta', { replace: true })
  }

  return (
    <Tarjeta eyebrow="Club Cleofas" titulo="Inicia sesión" sub="Entra a tu cuenta de socio para ver tus puntos, tu rango y tus beneficios.">
      {!supabaseReady ? <SinSupabase /> : (
        <form className="cuenta-acceso__form" onSubmit={onSubmit}>
          {aviso && <p className="cuenta-ok">{aviso}</p>}
          <label>Correo<input name="email" type="email" required placeholder="tu@correo.com" autoComplete="email" /></label>
          <label>Contraseña<CampoClave /></label>
          {error && <p className="admin-login__error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
          <div className="cuenta-acceso__links">
            <Link to="/cuenta/recuperar">¿Olvidaste tu contraseña?</Link>
            <Link to="/cuenta/registro">Crear cuenta gratis →</Link>
          </div>
        </form>
      )}
    </Tarjeta>
  )
}

export function Registro() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviadoA, setEnviadoA] = useState('')

  if (!loading && session && !session.demo && !enviadoA) return <Navigate to="/cuenta" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.target)
    const nombre = String(f.get('nombre')).trim()
    const email = String(f.get('email')).trim().toLowerCase()
    const telefono = String(f.get('telefono') || '').replace(/\D/g, '')
    const password = String(f.get('password'))
    const fecha_nacimiento = String(f.get('fecha_nacimiento') || '')
    if (nombre.length < 2) return setError('Escribe tu nombre.')
    if (telefono && (telefono.length < 8 || telefono.length > 15)) return setError('El teléfono no parece válido.')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== f.get('password2')) return setError('Las contraseñas no coinciden.')
    if (!f.get('acepta')) return setError('Debes aceptar el Aviso de privacidad para crear tu cuenta.')

    setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origen()}/cuenta?bienvenida=1`,
        data: { nombre, telefono, fecha_nacimiento, acepta_correos: Boolean(f.get('correos')) },
      },
    })
    setEnviando(false)
    if (error) return setError(traducirError(error))
    if (data.session) return navigate('/cuenta?bienvenida=1', { replace: true }) // si la confirmación por correo está apagada
    setEnviadoA(email)
  }

  if (enviadoA) {
    return (
      <Tarjeta eyebrow="Último paso" titulo="Activa tu cuenta">
        <div className="cuenta-acceso__form">
          <p className="cuenta-ok">Te enviamos un correo a <strong>{enviadoA}</strong>.</p>
          <p className="admin-login__sub">Abre el enlace de activación para entrar al Club Cleofas. Si no lo ves en unos minutos, revisa la carpeta de spam o promociones.</p>
          <Link to="/cuenta/entrar" className="btn btn-ghost">Ya la activé, iniciar sesión</Link>
        </div>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta eyebrow="Club Cleofas" titulo="Crea tu cuenta" sub="Gratis. Suma 1 punto por cada $1, sube de rango y desbloquea descuentos.">
      {!supabaseReady ? <SinSupabase /> : (
        <form className="cuenta-acceso__form" onSubmit={onSubmit}>
          <label>Nombre<input name="nombre" required maxLength={80} placeholder="¿Cómo te llamas?" autoComplete="name" /></label>
          <label>Correo<input name="email" type="email" required placeholder="tu@correo.com" autoComplete="email" /></label>
          <div className="cuenta-acceso__fila">
            <label>Teléfono (opcional)<input name="telefono" type="tel" placeholder="56 4625 3958" autoComplete="tel" /></label>
            <label>Cumpleaños (opcional)<input name="fecha_nacimiento" type="date" max={new Date().toISOString().slice(0, 10)} min="1920-01-01" autoComplete="bday" /></label>
          </div>
          <label>Contraseña<CampoClave autoComplete="new-password" placeholder="Mínimo 8 caracteres" minLength={8} /></label>
          <label>Repite la contraseña<CampoClave name="password2" autoComplete="new-password" placeholder="Igual que arriba" minLength={8} /></label>
          <label className="cuenta-check">
            <input type="checkbox" name="acepta" />
            <span>Acepto el <a href="/privacidad" target="_blank" rel="noopener noreferrer">Aviso de privacidad</a>.</span>
          </label>
          <label className="cuenta-check">
            <input type="checkbox" name="correos" defaultChecked />
            <span>Quiero recibir por correo mis cupones, promociones y eventos del club.</span>
          </label>
          {error && <p className="admin-login__error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear mi cuenta'}</button>
          <div className="cuenta-acceso__links">
            <span>¿Ya eres socio?</span>
            <Link to="/cuenta/entrar">Inicia sesión →</Link>
          </div>
        </form>
      )}
    </Tarjeta>
  )
}

export function Recuperar() {
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const email = String(new FormData(e.target).get('email')).trim().toLowerCase()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origen()}/cuenta/nueva-contrasena` })
    setEnviando(false)
    // Por seguridad no decimos si el correo existe o no.
    if (error && /rate|security|too many/i.test(error.message)) setError(traducirError(error))
    else setEnviado(true)
  }

  return (
    <Tarjeta eyebrow="Club Cleofas" titulo="Recupera tu acceso" sub={enviado ? null : 'Te enviaremos un enlace para crear una contraseña nueva.'}>
      {!supabaseReady ? <SinSupabase /> : enviado ? (
        <div className="cuenta-acceso__form">
          <p className="cuenta-ok">Si existe una cuenta con ese correo, te llegará un enlace en unos minutos.</p>
          <p className="admin-login__sub">El enlace vence en 1 hora. Revisa también spam o promociones.</p>
          <Link to="/cuenta/entrar" className="btn btn-ghost">Volver a iniciar sesión</Link>
        </div>
      ) : (
        <form className="cuenta-acceso__form" onSubmit={onSubmit}>
          <label>Correo<input name="email" type="email" required placeholder="tu@correo.com" autoComplete="email" /></label>
          {error && <p className="admin-login__error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar enlace'}</button>
          <div className="cuenta-acceso__links"><Link to="/cuenta/entrar">← Volver</Link></div>
        </form>
      )}
    </Tarjeta>
  )
}

export function NuevaContrasena() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(errorDeUrl)
  const [enviando, setEnviando] = useState(false)
  const [esperando, setEsperando] = useState(true)

  // El enlace del correo inicia sesión al cargar; damos un momento a que Supabase lo procese.
  useEffect(() => {
    const t = setTimeout(() => setEsperando(false), 2500)
    return () => clearTimeout(t)
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.target)
    const password = String(f.get('password'))
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== f.get('password2')) return setError('Las contraseñas no coinciden.')
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setEnviando(false)
    if (error) setError(traducirError(error))
    else navigate('/cuenta', { replace: true, state: { aviso: 'Listo, tu contraseña se actualizó.' } })
  }

  const sinSesion = !loading && !session && !esperando
  return (
    <Tarjeta eyebrow="Club Cleofas" titulo="Nueva contraseña">
      {sinSesion ? (
        <div className="cuenta-acceso__form">
          <p className="admin-login__error">{error || 'El enlace ya venció o no es válido.'}</p>
          <Link to="/cuenta/recuperar" className="btn btn-primary">Pedir otro enlace</Link>
        </div>
      ) : !session ? (
        <p className="admin-login__sub">Verificando tu enlace…</p>
      ) : (
        <form className="cuenta-acceso__form" onSubmit={onSubmit}>
          <label>Contraseña nueva<CampoClave autoComplete="new-password" placeholder="Mínimo 8 caracteres" minLength={8} /></label>
          <label>Repite la contraseña<CampoClave name="password2" autoComplete="new-password" placeholder="Igual que arriba" minLength={8} /></label>
          {error && <p className="admin-login__error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      )}
    </Tarjeta>
  )
}
