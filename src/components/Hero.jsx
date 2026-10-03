import { useEstacionesPublicas } from '../lib/estacionesPublicas'
import { horarioHoyTexto } from '../data/negocio'
import './Hero.css'

export default function Hero() {
  const { estaciones } = useEstacionesPublicas()
  const libres = estaciones.filter((e) => e.estado === 'libre').length
  const pcs = estaciones.filter((e) => e.id.startsWith('PC'))
  const consolas = estaciones.filter((e) => !e.id.startsWith('PC'))
  const etiqueta = (id) => id.replace(/-0?/, '') // PC-01 → PC1, XB-06 → XB6

  return (
    <section className="hero">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <p className="eyebrow">Puebla · Hoy abierto {horarioHoyTexto()}</p>
          <h1 className="hero__title">
            Tu estación te espera,
            <br />
            no la busques a ciegas.
          </h1>
          <p className="hero__lead">
            5 PC gaming con RTX y 6 consolas Xbox para jugar en línea con tus
            amigos. Consulta qué equipo está libre ahora mismo y aparta el tuyo
            desde el celular, sin llamar ni hacer fila en la entrada.
          </p>

          <div className="hero__actions">
            <a href="#reservar" className="btn btn-primary">Reservar una estación</a>
            <a href="#estaciones" className="btn btn-ghost">Ver disponibilidad</a>
          </div>

          <ul className="hero__specs">
            <li><strong>500 Mbps</strong> fibra simétrica</li>
            <li><strong>RTX 5070 Ti</strong> y monitores de hasta 500 Hz</li>
            <li><strong>Todas las edades</strong>, torneos los sábados</li>
          </ul>
        </div>

        <div className="hero__panel" aria-label="Disponibilidad en vivo">
          <div className="hero__panel-head">
            <span className="hero__live-dot" aria-hidden="true" />
            En vivo · piso de juego
          </div>
          <div className="hero__panel-big">
            {libres}
            <span> de {estaciones.length} libres</span>
          </div>
          {[pcs, consolas].map((grupo, i) => grupo.length > 0 && (
            <div key={i} className="hero__mini-grid">
              {grupo.map((e) => (
                <div key={e.id} className={`hero__cell hero__cell--${e.estado}`} title={`${e.id} · ${e.estado}`}>
                  {etiqueta(e.id)}
                </div>
              ))}
            </div>
          ))}
          <div className="hero__legend">
            <span><i className="hero__dot hero__dot--libre" />Libre</span>
            <span><i className="hero__dot hero__dot--sesion" />En sesión</span>
            <span><i className="hero__dot hero__dot--mantenimiento" />Mantenimiento</span>
          </div>
        </div>
      </div>
    </section>
  )
}
