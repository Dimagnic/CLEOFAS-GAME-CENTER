import { NEGOCIO, MAPA_EMBED, MAPA_LINK, whatsappUrl } from '../data/negocio'
import './Contact.css'

export default function Contact() {
  return (
    <section id="contacto" className="section contact">
      <div className="wrap contact__grid">
        <div>
          <p className="eyebrow">Ubicación</p>
          <h2 className="contact__title">Encuéntranos</h2>
          <ul className="contact__list">
            <li><strong>Dirección</strong>{NEGOCIO.direccion}</li>
            <li><strong>Horario</strong>{NEGOCIO.horario}</li>
            <li><strong>Teléfono y WhatsApp</strong><a href={`tel:${NEGOCIO.telefonoLink}`}>{NEGOCIO.telefono}</a></li>
            <li>
              <strong>Síguenos</strong>
              <span className="contact__redes">
                <a href={NEGOCIO.redes.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>
                <a href={NEGOCIO.redes.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href={NEGOCIO.redes.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
              </span>
            </li>
          </ul>
          <a
            className="btn btn-primary"
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Escribir por WhatsApp
          </a>
        </div>
        <div className="contact__map">
          <iframe
            title="Mapa de ubicación de Cleofas Game Center"
            src={MAPA_EMBED}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a className="contact__ruta" href={MAPA_LINK} target="_blank" rel="noopener noreferrer">Cómo llegar</a>
        </div>
      </div>
    </section>
  )
}
