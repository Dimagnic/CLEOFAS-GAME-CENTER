import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabaseReady } from '../../lib/supabaseClient'
import './admin.css'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      <Link to="/" className="admin-login__back">
        <span aria-hidden="true">&larr;</span> Volver al sitio
      </Link>
      <form className="admin-login__card" onSubmit={onSubmit}>
        <img src="/logo.jpg" alt="Cleofas Game Center" className="admin-login__logo" />
        <h1>Panel del negocio</h1>
        <p className="admin-login__sub">Acceso solo para el equipo de Cleofas Game Center.</p>

        <label>
          Correo
          <input name="email" type="email" required placeholder="tu@cleofas.com" />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" required placeholder="********" />
        </label>

        {error && <p className="admin-login__error">{error}</p>}

        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
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
