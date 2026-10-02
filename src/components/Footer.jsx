import { Link } from 'react-router-dom'
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
            <li>Av. Reforma 000, Centro, Puebla, Pue.</li>
            <li>Todos los días, 11:00 a 23:00</li>
            <li>
              <a href="https://wa.me/522220000000" target="_blank" rel="noreferrer">WhatsApp: 222 000 0000</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="wrap footer__bottom">
        <p>© {new Date().getFullYear()} Cleofas Game Center. Todos los derechos reservados.</p>
        <Link to="/panel" className="footer__admin">Panel del negocio</Link>
        <div className="footer__dev">
          <span>Desarrollado por</span>
          <img src="/logo-cero-claro.png" alt="Cero+" height="38" />
        </div>
      </div>
    </footer>
  )
}
