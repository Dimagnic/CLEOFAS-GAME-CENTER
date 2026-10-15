import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import './admin.css'

const ICONOS = {
  resumen: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  estaciones: 'M3 4h18v12H3zM8 20h8M12 16v4',
  reservaciones: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  caja: 'M3 7h18v12H3zM3 7l3-4h12l3 4M15 13h2',
}

const NAV = [
  { to: '/panel', label: 'Resumen', end: true, ico: 'resumen' },
  { to: '/panel/estaciones', label: 'Estaciones', ico: 'estaciones' },
  { to: '/panel/reservaciones', label: 'Reservaciones', ico: 'reservaciones' },
  { to: '/panel/caja', label: 'Caja del día', ico: 'caja' },
]

function Reloj() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const o = { timeZone: 'America/Mexico_City' }
  return (
    <div className="admin__reloj">
      <b>{ahora.toLocaleTimeString('es-MX', { ...o, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</b>
      <span>{ahora.toLocaleDateString('es-MX', { ...o, weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  )
}

export default function AdminLayout() {
  const { session, loading, signOut } = useAuth()

  if (loading) return <div className="admin-loading">Cargando panel…</div>
  if (!session) return <Navigate to="/panel/login" replace />

  const correo = session?.user?.email || 'equipo@cleofas'

  return (
    <div className="admin">
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <img src="/logo.jpg" alt="" />
          <div>
            <span>CLEOFAS</span>
            <small>Panel de control</small>
          </div>
        </div>
        <nav className="admin__nav" aria-label="Panel">
          {NAV.map((n, i) => (
            <NavLink key={n.to} to={n.to} end={n.end} style={{ '--i': i }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONOS[n.ico]} /></svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="admin__sitio">Ver sitio público ↗</Link>
        <button className="admin__signout" onClick={signOut}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9" /></svg>
          Cerrar sesión
        </button>
      </aside>

      <div className="admin__main">
        <header className="admin__top">
          <span className="admin__estado"><i />Sistema en línea</span>
          <Reloj />
          <span className="admin__usuario" title={correo}>{correo}</span>
        </header>
        <div className="admin__content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
