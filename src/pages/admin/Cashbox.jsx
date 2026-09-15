import { useStations } from '../../lib/StationsStore'

export default function Cashbox() {
  const { cierresHoy } = useStations()
  const total = cierresHoy.reduce((sum, c) => sum + (c.precio || 0), 0)

  return (
    <div>
      <header className="admin-page__head">
        <h1>Caja del día</h1>
        <p>Se llena sola conforme cierras sesiones en Estaciones — nada que sumar a mano.</p>
      </header>

      <div className="admin-cards">
        <div className="admin-card">
          <p className="admin-card__label">Total cobrado hoy</p>
          <p className="admin-card__value">${total}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Sesiones cerradas</p>
          <p className="admin-card__value">{cierresHoy.length}</p>
        </div>
      </div>

      {cierresHoy.length === 0 ? (
        <p className="admin-note">
          Aún no cierras ninguna sesión hoy. Ve a <strong>Estaciones</strong> y usa
          "Cerrar y cobrar" cuando un cliente termine.
        </p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Hora</th><th>Estación</th><th>Cliente</th><th>Cobrado</th></tr>
          </thead>
          <tbody>
            {cierresHoy.map((c, i) => (
              <tr key={i}>
                <td className="mono">{c.hora}</td>
                <td>{c.estacion}</td>
                <td>{c.cliente}</td>
                <td>${c.precio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
