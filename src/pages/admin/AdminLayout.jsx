import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import './admin.css'

const ICONOS = {
  resumen: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  estaciones: 'M3 4h18v12H3zM8 20h8M12 16v4',
  reservaciones: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  caja: 'M3 7h18v12H3zM3 7l3-4h12l3 4M15 13h2',
  tienda: 'M6 2h12l-1 20H7zM6 7h12',
  socios: 'M9 8a4 4 0 1 0 0-.01M2 21c1-4 4-6 7-6s6 2 7 6M17 11a3 3 0 1 0 0-.01M18 15c2 .5 3.5 2.5 4 5',
  rangos: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
  cupones: 'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM10 7v12',
  publicaciones: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
  ventas: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  inventario: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  hardware: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z',
  automatizacion: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
}

const NAV = [
  { to: '/panel', label: 'Resumen', end: true, ico: 'resumen' },
  { to: '/panel/estaciones', label: 'Estaciones', ico: 'estaciones' },
  { to: '/panel/reservaciones', label: 'Reservaciones', ico: 'reservaciones' },
  { to: '/panel/caja', label: 'Caja del día', ico: 'caja' },
  { to: '/panel/pos', label: 'POS · Tienda', ico: 'tienda' },
  { to: '/panel/ventas', label: 'Ventas', ico: 'ventas' },
  { to: '/panel/socios', label: 'Socios', ico: 'socios' },
  { to: '/panel/rangos', label: 'Rangos', ico: 'rangos' },
  { to: '/panel/cupones', label: 'Cupones', ico: 'cupones' },
  { to: '/panel/publicaciones', label: 'Publicaciones', ico: 'publicaciones' },
  { to: '/panel/automatizacion', label: 'Automatización', ico: 'automatizacion' },
  { to: '/panel/inventario', label: 'Inventario', ico: 'inventario' },
  { to: '/panel/hardware', label: 'Hardware', ico: 'hardware' },
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
  const { session, esEquipo, loading, signOut } = useAuth()

  if (loading) return <div className="admin-loading">Cargando panel…</div>
  if (!session) return <Navigate to="/panel/login" replace />
  if (!esEquipo) {
    // Un socio (cliente) con sesión iniciada no entra al panel.
    return (
      <div className="admin-login">
        <div className="admin-login__card">
          <p className="eyebrow">Acceso restringido</p>
          <h1>Solo equipo</h1>
          <p className="admin-login__sub">Tu cuenta es de socio del Club Cleofas y no tiene acceso al panel del negocio.</p>
          <Link to="/cuenta" className="btn btn-primary">Ir a mi cuenta</Link>
          <button className="admin__signout" onClick={signOut}>Cerrar sesión y entrar con otra cuenta</button>
        </div>
      </div>
    )
  }

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
