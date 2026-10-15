import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NEGOCIO, MAPA_LINK, horarioHoyTexto } from '../data/negocio'
import './Navbar.css'

const LINKS = [
  { href: '#estaciones', id: 'estaciones', label: 'Disponibilidad' },
  { href: '#tarifas', id: 'tarifas', label: 'Tarifas' },
  { href: '#reservar', id: 'reservar', label: 'Reservar' },
  { href: '#contacto', id: 'contacto', label: 'Ubicación' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activo, setActivo] = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // enlace resaltado según la sección que se está viendo
  useEffect(() => {
    const secciones = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean)
    if (!secciones.length) return undefined
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) setActivo(e.target.id) })
    }, { rootMargin: '-45% 0px -50% 0px' })
    secciones.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const cerrar = () => setOpen(false)

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''} ${open ? 'nav--open' : ''}`}>
      <div className="nav__top">
        <div className="wrap nav__top-row">
          <span className="nav__top-item"><i className="nav__dot" />Hoy abierto {horarioHoyTexto()}</span>
          <a className="nav__top-item nav__top-item--mapa" href={MAPA_LINK} target="_blank" rel="noopener noreferrer">Centro histórico de Puebla</a>
          <a className="nav__top-item nav__top-item--tel" href={`tel:${NEGOCIO.telefonoLink}`}>{NEGOCIO.telefono}</a>
        </div>
      </div>

      <div className="wrap nav__row">
        <Link to="/" className="nav__brand" onClick={cerrar}>
          <img src="/logo.jpg" alt="Cleofas Game Center" className="nav__mark" />
          <span className="nav__name">
            CLEOFAS <span className="nav__brand-accent">GAME CENTER</span>
          </span>
        </Link>

        <nav className={`nav__links ${open ? 'nav__links--open' : ''}`} aria-label="Principal">
          {LINKS.map((l, i) => (
            <a key={l.href} href={l.href} onClick={cerrar} className={activo === l.id ? 'is-active' : ''} style={{ '--i': i }}>
              <b>0{i + 1}</b>{l.label}
            </a>
          ))}
          <a href="#reservar" onClick={cerrar} className="nav__cta btn btn-primary" style={{ '--i': LINKS.length }}>Reservar ahora</a>
        </nav>

        <button className="nav__toggle" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  )
}
