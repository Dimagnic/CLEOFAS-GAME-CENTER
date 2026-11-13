import { useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import Particulas from '../../components/Particulas'
import './cuenta.css'

// Marco de las páginas del cliente: Reservar, Tienda, Mis pedidos y Mi cuenta.
export default function CuentaMarco({ children, ancho = false }) {
  const { session, esEquipo, signOut } = useAuth()
  const navigate = useNavigate()
  const conectado = Boolean(session && !session.demo)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <div className="cuenta">
      <Particulas />
      <header className="cuenta__top">
        <div className={`cuenta__wrap cuenta__top-row ${ancho ? 'cuenta__wrap--ancho' : ''}`}>
          <Link to="/" className="cuenta__brand">
            <img src="/logo.jpg" alt="" width="34" height="34" />
            <span>CLUB <em>CLEOFAS</em></span>
          </Link>
          <nav className="cuenta__nav">
            <NavLink to="/reservar">Reservar</NavLink>
            {conectado && <NavLink to="/cuenta/tienda">Tienda</NavLink>}
            {conectado && <NavLink to="/cuenta/pedidos">Mis pedidos</NavLink>}
            {conectado ? <NavLink to="/cuenta" end>Mi cuenta</NavLink> : <NavLink to="/cuenta/entrar">Entrar</NavLink>}
            {esEquipo && <Link to="/panel">Panel</Link>}
            {conectado && <button onClick={async () => { await signOut(); navigate('/', { replace: true }) }}>Salir</button>}
          </nav>
        </div>
      </header>
      <main className={`cuenta__wrap cuenta__main ${ancho ? 'cuenta__wrap--ancho' : ''}`}>{children}</main>
    </div>
  )
}
