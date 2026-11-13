import { useStations } from '../../lib/StationsStore'

export default function Cashbox() {
  const { cierresHoy } = useStations()
  const total = cierresHoy.reduce((sum, c) => sum + (c.precio || 0), 0)
  const tienda = cierresHoy.filter((c) => c.tipo === 'snack').reduce((sum, c) => sum + (c.precio || 0), 0)
  const sesiones = cierresHoy.filter((c) => c.tipo !== 'snack')

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
          <p className="admin-card__value">{sesiones.length}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card__label">Tienda (snacks)</p>
          <p className="admin-card__value">${tienda}</p>
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
            <tr><th>Hora</th><th>Concepto</th><th>Cliente</th><th>Cobrado</th></tr>
          </thead>
          <tbody>
            {cierresHoy.map((c, i) => (
              <tr key={i}>
                <td className="mono">{c.hora}</td>
                <td>{c.tipo === 'snack' ? <>Tienda<br /><span className="mono">{c.detalle}</span></> : c.estacion}</td>
                <td>{c.cliente}{c.socioId ? ' · socio' : ''}</td>
                <td>${c.precio}{c.descuento > 0 ? <span className="mono"> (−${c.descuento})</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
