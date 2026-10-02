import { NEGOCIO, whatsappUrl } from '../data/negocio'
import { TIKTOK_PATH, FACEBOOK_PATH, WHATSAPP_PATH } from './iconos-redes'
import './FloatingSocial.css'

// Botones flotantes a la derecha, de arriba hacia abajo:
// TikTok · Instagram · Facebook · WhatsApp · (espacio reservado para el asistente virtual de clienteai.site)
export default function FloatingSocial() {
  return (
    <aside className="float" aria-label="Redes sociales y contacto">
      <a className="float__btn float__btn--tiktok" href={NEGOCIO.redes.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok de Cleofas Game Center">
        <svg viewBox="-1 -1 26 26" aria-hidden="true">
          <path d={TIKTOK_PATH} fill="#25F4EE" transform="translate(-0.9 -0.7)" />
          <path d={TIKTOK_PATH} fill="#FE2C55" transform="translate(0.9 0.7)" />
          <path d={TIKTOK_PATH} fill="#fff" />
        </svg>
        <span className="float__label">TikTok</span>
      </a>

      <a className="float__btn float__btn--instagram" href={NEGOCIO.redes.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram de Cleofas Game Center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5.2" />
          <circle cx="12" cy="12" r="4.1" />
          <circle cx="17.4" cy="6.6" r="1.15" fill="#fff" stroke="none" />
        </svg>
        <span className="float__label">Instagram</span>
      </a>

      <a className="float__btn float__btn--facebook" href={NEGOCIO.redes.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook de Cleofas Game Center">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={FACEBOOK_PATH} fill="#fff" />
        </svg>
        <span className="float__label">Facebook</span>
      </a>

      <a className="float__btn float__btn--whatsapp" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={WHATSAPP_PATH} fill="#fff" />
        </svg>
        <span className="float__label">WhatsApp</span>
      </a>

      {/* Espacio reservado para el botón del asistente virtual de clienteai.site (se agrega después). */}
      <div className="float__slot" id="asistente-virtual" aria-hidden="true" />
    </aside>
  )
}
