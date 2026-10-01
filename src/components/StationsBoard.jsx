import { useEstacionesPublicas } from '../lib/estacionesPublicas'
import './StationsBoard.css'

const ETIQUETA = {
  libre: 'Libre',
  sesion: 'En sesión',
  mantenimiento: 'Mantenimiento',
}

export default function StationsBoard() {
  const { estaciones, cargando, error } = useEstacionesPublicas()

  return (
    <section id="estaciones" className="section stations">
      <div className="wrap">
        <div className="stations__head">
          <div>
            <p className="eyebrow">Disponibilidad</p>
            <h2 className="stations__title">Qué está libre ahora mismo</h2>
          </div>
          <p className="stations__note">
            El piso se actualiza solo. Si tu estación favorita está ocupada,
            resérvala para cuando se libere en vez de venir a preguntar.
          </p>
        </div>

        {cargando && <p className="stations__note">Cargando disponibilidad…</p>}
        {error && <p className="stations__note">No pudimos cargar la disponibilidad ahora. Intenta de nuevo en un momento.</p>}

        <div className="stations__grid">
          {estaciones.map((e) => (
            <article key={e.id} className={`station-card station-card--${e.estado}`}>
              <div className="station-card__top">
                <span className="station-card__id">{e.id}</span>
                <span className="station-card__status">{ETIQUETA[e.estado]}</span>
              </div>
              <p className="station-card__type">{e.tipo}</p>
              <p className="station-card__specs">{e.specs}</p>
              {e.estado === 'sesion' && (
                <p className="station-card__timer">{e.restanteMin > 0 ? `Libre en ~${e.restanteMin} min` : 'Por liberarse'}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
