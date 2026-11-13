import { useEffect, useState } from 'react'
import { RESERVACIONES } from '../../data/mockData'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import PedidoAdmin from './PedidoAdmin'

const ETIQUETAS = {
  confirmada: 'pagada',
  pendiente: 'pendiente',
  pendiente_pago: 'esperando pago',
  cancelada: 'cancelada',
  expirada: 'expirada',
}

export default function Reservations() {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')

  async function cargar() {
    if (!supabaseReady) {
      setFilas(RESERVACIONES.map((r) => ({ ...r, duracion_h: r.duracionH })))
      return
    }
    const consulta = (campos) => supabase
      .from('reservaciones')
      .select(campos)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(200)
    let { data, error } = await consulta('*, venta:ventas!reservaciones_venta_id_fkey(*, venta_items(id, nombre, cantidad, precio_unit, subtotal))')
    if (error) ({ data, error } = await consulta('*')) // sin pedidos de tienda instalados
    if (error) setError(error.message)
    else setFilas(data)
  }

  useEffect(() => { cargar() }, [])

  async function cancelar(r) {
    const aviso = r.estado === 'confirmada'
      ? `Esto libera el horario pero NO reembolsa a ${r.cliente}: el reembolso se hace desde tu panel de Stripe. ¿Cancelar ${r.folio}?`
      : `¿Cancelar la reservación ${r.folio}?`
    if (!window.confirm(aviso)) return
    const { error } = await supabase.from('reservaciones').update({ estado: 'cancelada' }).eq('id', r.id)
    if (error) setError(error.message)
    else cargar()
  }

  const [soloPedidos, setSoloPedidos] = useState(false)
  const pagadasHoy = (filas ?? []).filter((r) => r.estado === 'confirmada')
  const porCobrar = pagadasHoy.filter((r) => r.venta?.estado === 'pendiente')
  const totalPorCobrar = porCobrar.reduce((s, r) => s + Number(r.venta.total || 0), 0)
  const conPedido = pagadasHoy.filter((r) => r.venta)
  const visibles = (filas ?? []).filter((r) => !soloPedidos || r.venta)
  const totalPagado = pagadasHoy.reduce((s, r) => s + Number(r.monto || 0), 0)

  return (
    <div>
      <header className="admin-page__head">
        <h1>Reservaciones</h1>
        <p>Lo que la gente aparta y paga desde la página, en un solo lugar.</p>
      </header>

      {supabaseReady && (
        <div className="admin-cards">
          <div className="admin-card">
            <p className="admin-card__label">Reservas pagadas (últimas 200)</p>
            <p className="admin-card__value">{pagadasHoy.length}</p>
          </div>
          <div className="admin-card">
            <p className="admin-card__label">Cobrado en línea</p>
            <p className="admin-card__value">${totalPagado}</p>
          </div>
          <div className="admin-card">
            <p className="admin-card__label">Reservas con pedido de tienda</p>
            <p className="admin-card__value">{conPedido.length}</p>
          </div>
          <div className="admin-card">
            <p className="admin-card__label">Pedidos por cobrar en mostrador</p>
            <p className="admin-card__value">${totalPorCobrar}</p>
          </div>
        </div>
      )}
      {supabaseReady && (
        <label className="admin-filtro">
          <input type="checkbox" checked={soloPedidos} onChange={(e) => setSoloPedidos(e.target.checked)} /> Ver solo reservas con pedido de tienda
        </label>
      )}

      {error && <p className="admin-note">Error: {error}</p>}
      {!filas && !error && <p className="admin-note">Cargando…</p>}

      {filas && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Folio</th><th>Cliente</th><th>Contacto</th><th>Estación</th><th>Cuándo</th>
              <th>Duración</th><th>Monto</th><th>Pedido de tienda</th><th>Estado</th>{supabaseReady && <th></th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.folio}>
                <td className="mono">{r.folio}</td>
                <td>{r.cliente}</td>
                <td>{r.email || '—'}{r.telefono ? <><br />{r.telefono}</> : null}</td>
                <td>{r.estacion}</td>
                <td>{r.fecha} · {String(r.hora).slice(0, 5)}</td>
                <td>{r.duracion_h} h</td>
                <td>{r.monto ? `$${r.monto}` : '—'}</td>
                <td className="admin-table__pedido"><PedidoAdmin r={r} onCambio={cargar} compacto /></td>
                <td><span className={`estado-pill estado-pill--${r.estado}`}>{ETIQUETAS[r.estado] ?? r.estado}</span></td>
                {supabaseReady && (
                  <td>
                    {['confirmada', 'pendiente', 'pendiente_pago'].includes(r.estado) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => cancelar(r)}>Cancelar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!supabaseReady && (
        <p className="admin-note">
          Modo demo. Conecta Supabase (ver <code>supabase/schema.sql</code> y <code>supabase/migration-pagos.sql</code>)
          para ver aquí las reservas reales.
        </p>
      )}
    </div>
  )
}
