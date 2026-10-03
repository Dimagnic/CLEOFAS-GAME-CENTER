import { Link } from 'react-router-dom'
import { NEGOCIO, MAPA_LINK, whatsappUrl } from '../data/negocio'
import './Footer.css'

const ENLACES = [
  { href: '#estaciones', label: 'Disponibilidad' },
  { href: '#tarifas', label: 'Tarifas' },
  { href: '#reservar', label: 'Reservar' },
  { href: '#contacto', label: 'Ubicación' },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div className="footer__col">
          <div className="footer__brand">
            <img src="/logo.jpg" alt="" width="36" height="36" />
            <span>CLEOFAS GAME CENTER</span>
          </div>
          <p>Renta de estaciones gaming por hora, torneos y eventos en Puebla. Reserva y paga tu horario en línea.</p>
        </div>

        <nav className="footer__col" aria-label="Navegación del pie de página">
          <h3>Navegación</h3>
          <ul>
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
            <li className="footer__redes">
              <a href={NEGOCIO.redes.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>
              <a href={NEGOCIO.redes.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href={NEGOCIO.redes.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="wrap footer__bottom">
        <p>© {new Date().getFullYear()} Cleofas Game Center. Todos los derechos reservados.</p>
        <Link to="/panel" className="footer__admin">Panel del negocio</Link>
        <div className="footer__dev">
          <span>Desarrollado por</span>
          <a href={NEGOCIO.desarrolladoPor.url} target="_blank" rel="noopener noreferrer" className="footer__cero" aria-label="Cero+, desarrollador del sitio">
            <img src="/logo-cero-claro.png" alt="Cero+" height="38" />
          </a>
        </div>
      </div>
    </footer>
  )
}
