import { useEstacionesPublicas } from '../lib/estacionesPublicas'
import { NEGOCIO } from '../data/negocio'
import './Hero.css'

export default function Hero() {
  const { estaciones } = useEstacionesPublicas()
  const libres = estaciones.filter((e) => e.estado === 'libre').length

  return (
    <section className="hero">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <p className="eyebrow">Puebla · Abierto {NEGOCIO.horarioCorto}</p>
          <h1 className="hero__title">
            Tu estación te espera,
            <br />
            no la busques a ciegas.
          </h1>
          <p className="hero__lead">
            10 estaciones PC con RTX y sala de consolas para jugar en línea con tus
            amigos. Consulta qué equipo está libre ahora mismo y aparta el tuyo
            desde el celular, sin llamar ni hacer fila en la entrada.
          </p>

          <div className="hero__actions">
            <a href="#reservar" className="btn btn-primary">Reservar una estación</a>
            <a href="#estaciones" className="btn btn-ghost">Ver disponibilidad</a>
          </div>

          <ul className="hero__specs">
            <li><strong>500 Mbps</strong> fibra simétrica</li>
            <li><strong>RTX 4060 / 3060</strong> en todas las PC</li>
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
          <div className="hero__mini-grid">
            {estaciones.slice(0, 10).map((e) => (
              <div key={e.id} className={`hero__cell hero__cell--${e.estado}`} title={`${e.id} · ${e.estado}`}>
                {e.id.split('-')[1]}
              </div>
            ))}
          </div>
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
