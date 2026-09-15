import { RESERVACIONES } from '../../data/mockData'

export default function Reservations() {
  return (
    <div>
      <header className="admin-page__head">
        <h1>Reservaciones</h1>
        <p>Lo que la gente aparta desde la página, en un solo lugar.</p>
      </header>

      <table className="admin-table">
        <thead>
          <tr><th>Folio</th><th>Cliente</th><th>Estación</th><th>Cuándo</th><th>Duración</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {RESERVACIONES.map((r) => (
            <tr key={r.folio}>
              <td className="mono">{r.folio}</td>
              <td>{r.cliente}</td>
              <td>{r.estacion}</td>
              <td>{r.fecha} · {r.hora}</td>
              <td>{r.duracionH} h</td>
              <td><span className={`estado-pill estado-pill--${r.estado}`}>{r.estado}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="admin-note">
        Conecta la tabla <code>reservaciones</code> de Supabase (ver <code>supabase/schema.sql</code>)
        para que esta lista se llene con lo que la gente reserva desde la página pública.
      </p>
    </div>
  )
}
