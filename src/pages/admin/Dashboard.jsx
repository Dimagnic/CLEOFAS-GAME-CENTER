import { RESERVACIONES, RESUMEN_HOY } from '../../data/mockData'
import { useStations } from '../../lib/StationsStore'

const ETIQUETAS = { confirmada: 'pagada', pendiente_pago: 'esperando pago', pendiente: 'pendiente' }

const cuando = (ms) =>
  new Date(ms).toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })

export default function Dashboard() {
  const { estaciones: ESTACIONES, enLinea, reservas, cierresHoy } = useStations()
  const libres = ESTACIONES.filter((e) => e.estado === 'libre').length
  const enSesion = ESTACIONES.filter((e) => e.estado === 'sesion').length

  // Con Supabase conectado todo es real; en modo demo se muestran datos de ejemplo.
  const proximas = enLinea
    ? reservas.map((r) => ({ folio: r.folio, cliente: r.cliente, estacion: r.estacion, cuando: cuando(r.iniMs), estado: r.estado }))
    : RESERVACIONES.map((r) => ({ ...r, cuando: `${r.fecha} · ${r.hora}` }))

  const totalCobrado = cierresHoy.reduce((s, c) => s + (c.precio || 0), 0)
  const ticket = enLinea
    ? (cierresHoy.length ? `$${Math.round(totalCobrado / cierresHoy.length)}` : '—')
    : `$${RESUMEN_HOY.ticketPromedio}`

  return (
    <div>
      <header className="admin-page__head">
        <h1>Resumen de hoy</h1>
        <p>Así está el piso en este momento.</p>
      </header>

      <div className="admin-cards">
        <div className="admin-card">
          <p className="admin-card__label">Ocupación</p>
          <p className="admin-card__value">{ESTACIONES.length ? Math.round((enSesion / ESTACIONES.length) * 100) : 0}%</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Estaciones libres</p>
          <p className="admin-card__value">{libres} de {ESTACIONES.length}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Reservaciones próximas</p>
          <p className="admin-card__value">{proximas.length}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Ticket promedio</p>
          <p className="admin-card__value">{ticket}</p>
        </div>
      </div>

      <section className="admin-section">
        <h2>Próximas reservaciones</h2>
        {proximas.length === 0 ? (
          <p className="admin-note">No hay reservaciones en línea próximas. Cuando alguien reserve y pague, aparecerá aquí.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Folio</th><th>Cliente</th><th>Estación</th><th>Cuándo</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {proximas.map((r) => (
                <tr key={r.folio}>
                  <td className="mono">{r.folio}</td>
                  <td>{r.cliente}</td>
                  <td>{r.estacion}</td>
                  <td>{r.cuando}</td>
                  <td><span className={`estado-pill estado-pill--${r.estado}`}>{ETIQUETAS[r.estado] ?? r.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
