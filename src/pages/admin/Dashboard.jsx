import { ESTACIONES, RESERVACIONES, RESUMEN_HOY } from '../../data/mockData'

export default function Dashboard() {
  const libres = ESTACIONES.filter((e) => e.estado === 'libre').length
  const enSesion = ESTACIONES.filter((e) => e.estado === 'sesion').length

  return (
    <div>
      <header className="admin-page__head">
        <h1>Resumen de hoy</h1>
        <p>Así está el piso en este momento.</p>
      </header>

      <div className="admin-cards">
        <div className="admin-card">
          <p className="admin-card__label">Ocupación</p>
          <p className="admin-card__value">{Math.round((enSesion / ESTACIONES.length) * 100)}%</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Estaciones libres</p>
          <p className="admin-card__value">{libres} de {ESTACIONES.length}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Reservaciones próximas</p>
          <p className="admin-card__value">{RESERVACIONES.length}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Ticket promedio</p>
          <p className="admin-card__value">${RESUMEN_HOY.ticketPromedio}</p>
        </div>
      </div>

      <section className="admin-section">
        <h2>Próximas reservaciones</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Folio</th><th>Cliente</th><th>Estación</th><th>Cuándo</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {RESERVACIONES.map((r) => (
              <tr key={r.folio}>
                <td className="mono">{r.folio}</td>
                <td>{r.cliente}</td>
                <td>{r.estacion}</td>
                <td>{r.fecha} · {r.hora}</td>
                <td><span className={`estado-pill estado-pill--${r.estado}`}>{r.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
