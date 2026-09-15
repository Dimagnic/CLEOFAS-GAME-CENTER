import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__row">
        <div className="footer__brand">
          <img src="/logo.jpg" alt="Cleofas Game Center" />
          <span>CLEOFAS GAME CENTER</span>
        </div>
        <p>© {new Date().getFullYear()} Cleofas Game Center. Todos los derechos reservados.</p>
        <Link to="/panel" className="footer__admin">Panel del negocio</Link>
      </div>
    </footer>
  )
}
