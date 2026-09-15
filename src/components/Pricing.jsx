import { TARIFAS } from '../data/mockData'
import './Pricing.css'

export default function Pricing() {
  return (
    <section id="tarifas" className="section pricing">
      <div className="wrap">
        <p className="eyebrow">Tarifas</p>
        <h2 className="pricing__title">Paga por el tiempo que juegas</h2>

        <div className="pricing__grid">
          {TARIFAS.map((t) => (
            <article key={t.id} className={`price-card ${t.destacado ? 'price-card--destacado' : ''}`}>
              {t.destacado && <span className="price-card__tag">Más elegido</span>}
              <h3 className="price-card__nombre">{t.nombre}</h3>
              <p className="price-card__precio">${t.precio}<span> MXN</span></p>
              <p className="price-card__detalle">{t.detalle}</p>
            </article>
          ))}
        </div>
        <p className="pricing__foot">
          Los paquetes no caducan el mismo día: puedes usar tus horas restantes
          otra visita dentro del mes.
        </p>
      </div>
    </section>
  )
}
