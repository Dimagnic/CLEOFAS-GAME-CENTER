import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NEGOCIO, MAPA_LINK, whatsappUrl, horarioDe, formato12 } from '../data/negocio'
import { TIKTOK_PATH, FACEBOOK_PATH, WHATSAPP_PATH } from './iconos-redes'
import './Footer.css'

const ENLACES = [
  { href: '#estaciones', label: 'Disponibilidad' },
  { href: '#tarifas', label: 'Tarifas' },
  { href: '#reservar', label: 'Reservar' },
  { href: '#contacto', label: 'Ubicación' },
]

// ¿Está abierto ahora? (hora de Puebla)
function estadoAhora() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const g = (t) => f.find((p) => p.type === t).value
  const { abre, cierra } = horarioDe(`${g('year')}-${g('month')}-${g('day')}`)
  const min = (Number(g('hour')) % 24) * 60 + Number(g('minute'))
  return min >= abre && min < cierra
    ? { abierto: true, texto: `Abierto ahora · cierra ${formato12(cierra)}` }
    : { abierto: false, texto: 'Cerrado ahora · reserva para después' }
}

export default function Footer() {
  const [estado, setEstado] = useState(estadoAhora)
  useEffect(() => {
    const t = setInterval(() => setEstado(estadoAhora()), 60000)
    return () => clearInterval(t)
  }, [])

  return (
    <footer className="footer">
      <div className="footer__rayo" aria-hidden="true" />

      <div className="wrap footer__cta">
        <div>
          <p className="eyebrow">Tu turno</p>
          <h2 className="footer__cta-titulo">¿Listo para <span className="hl">jugar</span>?</h2>
        </div>
        <div className="footer__cta-acciones">
          <a href="#reservar" className="btn btn-primary">Reservar estación</a>
          <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Escribir por WhatsApp</a>
        </div>
      </div>

      <div className="wrap footer__grid">
        <div className="footer__col">
          <div className="footer__brand">
            <img src="/logo.jpg" alt="" width="40" height="40" />
            <span>CLEOFAS <b>GAME CENTER</b></span>
          </div>
          <p>Renta de estaciones gaming por hora, torneos y eventos en Puebla. Reserva y paga tu horario en línea.</p>
          <p className={`footer__estado ${estado.abierto ? 'footer__estado--on' : ''}`}><i />{estado.texto}</p>
          <div className="footer__redes">
            <a href={NEGOCIO.redes.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="footer__red footer__red--tiktok">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={TIKTOK_PATH} fill="currentColor" /></svg>
            </a>
            <a href={NEGOCIO.redes.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer__red footer__red--instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
            </a>
            <a href={NEGOCIO.redes.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="footer__red footer__red--facebook">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={FACEBOOK_PATH} fill="currentColor" /></svg>
            </a>
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="footer__red footer__red--whatsapp">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={WHATSAPP_PATH} fill="currentColor" /></svg>
            </a>
          </div>
        </div>

        <nav className="footer__col" aria-label="Navegación del pie de página">
          <h3>Navegación</h3>
          <ul className="footer__nav">
            {ENLACES.map((l) => (
              <li key={l.href}><a href={l.href}>{l.label}</a></li>
            ))}
          </ul>
        </nav>

        <div className="footer__col">
          <h3>Contacto</h3>
          <ul>
            <li><a href={MAPA_LINK} target="_blank" rel="noopener noreferrer">{NEGOCIO.direccion}</a></li>
            {NEGOCIO.horarioLineas.map((l) => <li key={l}>{l}</li>)}
            <li><a href={`tel:${NEGOCIO.telefonoLink}`}>Tel: {NEGOCIO.telefono}</a></li>
            <li><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp: {NEGOCIO.telefono}</a></li>
          </ul>
        </div>
      </div>

      <div className="footer__marca" aria-hidden="true">CLEOFAS</div>

      <div className="wrap footer__bottom">
        <p>© {new Date().getFullYear()} Cleofas Game Center. Todos los derechos reservados.</p>
        <div className="footer__legal">
          <Link to="/privacidad">Aviso de privacidad</Link>
          <Link to="/politica-de-cancelacion">Cancelaciones y reembolsos</Link>
        </div>
        <Link to="/panel" className="footer__admin">Panel del negocio</Link>
        <div className="footer__dev">
          <span>Desarrollado por</span>
          <a href={NEGOCIO.desarrolladoPor.url} target="_blank" rel="noopener noreferrer" className="footer__cero" aria-label="Cero+, desarrollador del sitio">
            <img src="/logo-cero-claro.png" alt="Cero+" height="38" />
          </a>
        </div>
      </div>

      <button className="footer__arriba" aria-label="Volver arriba" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </footer>
  )
}
