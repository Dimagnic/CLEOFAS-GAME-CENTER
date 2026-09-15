import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'

const LINKS = [
  { href: '#estaciones', label: 'Disponibilidad' },
  { href: '#tarifas', label: 'Tarifas' },
  { href: '#reservar', label: 'Reservar' },
  { href: '#contacto', label: 'Ubicación' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="wrap nav__row">
        <Link to="/" className="nav__brand" onClick={() => setOpen(false)}>
          <img src="/logo.jpg" alt="Cleofas Game Center" className="nav__mark" />
          <span>
            CLEOFAS <span className="nav__brand-accent">GAME CENTER</span>
          </span>
        </Link>

        <nav className={`nav__links ${open ? 'nav__links--open' : ''}`}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <NavLink to="/panel" className="nav__admin-link" onClick={() => setOpen(false)}>
            Panel del negocio
          </NavLink>
        </nav>

        <button
          className="nav__toggle"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  )
}
