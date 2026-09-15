import './Contact.css'

export default function Contact() {
  return (
    <section id="contacto" className="section contact">
      <div className="wrap contact__grid">
        <div>
          <p className="eyebrow">Ubicación</p>
          <h2 className="contact__title">Encuéntranos</h2>
          <ul className="contact__list">
            <li><strong>Dirección</strong>Av. Reforma 000, Centro, Puebla, Pue.</li>
            <li><strong>Horario</strong>Todos los días, 11:00 a 23:00</li>
            <li><strong>WhatsApp</strong>222 000 0000</li>
          </ul>
          <a
            className="btn btn-primary"
            href="https://wa.me/522220000000"
            target="_blank"
            rel="noreferrer"
          >
            Escribir por WhatsApp
          </a>
        </div>
        <div className="contact__map" role="img" aria-label="Mapa de ubicación de Cleofas Game Center">
          <span>Mapa · Centro de Puebla</span>
        </div>
      </div>
    </section>
  )
}
