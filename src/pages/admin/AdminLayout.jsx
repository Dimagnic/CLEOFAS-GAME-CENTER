import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import './admin.css'

const NAV = [
  { to: '/panel', label: 'Resumen', end: true },
  { to: '/panel/estaciones', label: 'Estaciones' },
  { to: '/panel/reservaciones', label: 'Reservaciones' },
  { to: '/panel/caja', label: 'Caja del día' },
]

export default function AdminLayout() {
  const { session, loading, signOut } = useAuth()

  if (loading) return <div className="admin-loading">Cargando panel…</div>
  if (!session) return <Navigate to="/panel/login" replace />

  return (
    <div className="admin">
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <img src="/logo.jpg" alt="" />
          <span>CLEOFAS</span>
        </div>
        <nav className="admin__nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button className="admin__signout" onClick={signOut}>Cerrar sesión</button>
      </aside>
      <div className="admin__content">
        <Outlet />
      </div>
    </div>
  )
}
