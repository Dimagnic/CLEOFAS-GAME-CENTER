import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabaseReady } from '../../lib/supabaseClient'
import FondoVideo from '../../components/FondoVideo'
import Particulas from '../../components/Particulas'
import './admin.css'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ver, setVer] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.target)
    try {
      await signIn(form.get('email'), form.get('password'))
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <FondoVideo posicion="50% 40%" />
      <Particulas />
      <Link to="/" className="admin-login__back">
        <span aria-hidden="true">&larr;</span> Volver al sitio
      </Link>
      <form className="admin-login__card" onSubmit={onSubmit}>
        <div className="admin-login__escudo">
          <img src="/logo.jpg" alt="Cleofas Game Center" className="admin-login__logo" />
        </div>
        <p className="eyebrow">Acceso seguro</p>
        <h1>Panel de control</h1>
        <p className="admin-login__sub">Acceso solo para el equipo de Cleofas Game Center.</p>

        <label>
          Correo
          <input name="email" type="email" required placeholder="tu@cleofas.com" autoComplete="username" />
        </label>
        <label>
          Contraseña
          <span className="admin-login__campo">
            <input name="password" type={ver ? 'text' : 'password'} required placeholder="********" autoComplete="current-password" />
            <button type="button" className="admin-login__ver" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? 'Ocultar' : 'Ver'}</button>
          </span>
        </label>

        {error && <p className="admin-login__error">{error}</p>}

        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Verificando…' : 'Entrar al panel'}
        </button>

        {!supabaseReady && (
          <p className="admin-login__hint">
            Modo demo: usa la contraseña <code>cleofas2026</code> con cualquier correo.
          </p>
        )}
      </form>
    </div>
  )
}
