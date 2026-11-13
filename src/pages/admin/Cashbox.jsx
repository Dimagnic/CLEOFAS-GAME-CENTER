import { useStations } from '../../lib/StationsStore'
import { METODOS, ORIGENES, pesos } from '../../lib/ventas'

const hora = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

export default function Cashbox() {
  const { cierresHoy, ventasHoy = [] } = useStations()

  // Sesiones cobradas en mostrador (cierres) + ventas de tienda pagadas hoy (POS, pedidos y en línea).
  // Los cobros de tienda anteriores al POS (cierres tipo snack) también se incluyen.
  const movimientos = [
    ...cierresHoy.filter((c) => (c.precio || 0) > 0 || c.tipo !== 'snack').map((c) => ({
      clave: `c-${c.hora}-${c.estacion}-${c.cliente}`, hora: c.hora, concepto: c.tipo === 'snack' ? `Tienda · ${c.detalle}` : `Sesión ${c.estacion}`,
      cliente: c.cliente, total: Number(c.precio || 0), metodo: c.metodo ?? 'efectivo', socio: Boolean(c.socioId),
    })),
    ...ventasHoy.map((v) => ({
      clave: v.folio, hora: hora(v.pagada_at), concepto: `${ORIGENES[v.origen]} · ${v.folio}`,
      detalle: (v.venta_items ?? []).map((i) => `${i.cantidad}× ${i.nombre}`).join(', '),
      cliente: v.cliente, total: Number(v.total), metodo: v.metodo_pago, socio: Boolean(v.socio_id),
    })),
  ].sort((a, b) => String(b.hora).localeCompare(String(a.hora)))

  const porMetodo = Object.fromEntries(Object.keys(METODOS).map((m) => [m, movimientos.filter((x) => x.metodo === m).reduce((s, x) => s + x.total, 0)]))
  const enCaja = porMetodo.efectivo
  const total = movimientos.reduce((s, x) => s + x.total, 0)
  const sesiones = cierresHoy.filter((c) => c.tipo !== 'snack').reduce((s, c) => s + Number(c.precio || 0), 0)

  return (
    <div>
      <header className="admin-page__head">
        <h1>Caja del día</h1>
        <p>Se llena sola con las sesiones cerradas en Estaciones y las ventas del POS y de la tienda en línea.</p>
      </header>

      <div className="admin-cards">
        <div className="admin-card"><p className="admin-card__label">Total del día</p><p className="admin-card__value">{pesos(total)}</p></div>
        <div className="admin-card admin-card--ok"><p className="admin-card__label">Efectivo en caja</p><p className="admin-card__value">{pesos(enCaja)}</p></div>
        <div className="admin-card"><p className="admin-card__label">Terminal · QR</p><p className="admin-card__value">{pesos(porMetodo.terminal + porMetodo.qr)}</p></div>
        <div className="admin-card"><p className="admin-card__label">En línea (Stripe)</p><p className="admin-card__value">{pesos(porMetodo.en_linea)}</p></div>
      </div>
      <p className="admin-note">Sesiones: {pesos(sesiones)} · Tienda: {pesos(total - sesiones)} · Terminal: {pesos(porMetodo.terminal)} · QR / transferencia: {pesos(porMetodo.qr)}</p>

      {movimientos.length === 0 ? (
        <p className="admin-note">Aún no hay cobros hoy. Cierra sesiones en <strong>Estaciones</strong> o vende en el <strong>POS</strong>.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Hora</th><th>Concepto</th><th>Cliente</th><th>Método</th><th>Importe</th></tr></thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.clave}>
                <td className="mono">{m.hora}</td>
                <td>{m.concepto}{m.detalle ? <><br /><span className="mono">{m.detalle}</span></> : null}</td>
                <td>{m.cliente}{m.socio ? ' · socio' : ''}</td>
                <td>{METODOS[m.metodo]?.corto ?? m.metodo}</td>
                <td>{pesos(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
