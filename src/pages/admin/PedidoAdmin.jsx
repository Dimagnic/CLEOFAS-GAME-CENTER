import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useStations } from '../../lib/StationsStore'

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`

// Estado del pedido de tienda de una reserva: qué pidió, cómo paga y si ya se cobró/entregó.
export function estadoPedido(r) {
  if (!r?.snacks_pago) return null
  if (r.snacks_pago === 'en_linea') return r.snacks_estado === 'pagado' ? ['pagado', 'Pagado en línea'] : ['espera', 'Se paga con la reserva']
  return r.snacks_estado === 'pagado' ? ['pagado', 'Cobrado en efectivo'] : ['efectivo', `Cobrar ${pesos(r.snacks_total)} en efectivo`]
}

// r = fila de reservaciones con snacks_* y reserva_productos(nombre, cantidad)
export default function PedidoAdmin({ r, onCambio, compacto = false }) {
  const { refrescar } = useStations()
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const estado = estadoPedido(r)
  if (!estado) return compacto ? <span className="mono">—</span> : null
  const productos = r.reserva_productos ?? []
  const confirmada = r.estado === 'confirmada'

  async function accion(fn, args, aviso) {
    if (aviso && !window.confirm(aviso)) return
    setTrabajando(true); setError('')
    const { error } = await supabase.rpc(fn, args)
    setTrabajando(false)
    if (error) return setError(error.message)
    refrescar?.()
    onCambio?.()
  }

  return (
    <div className={`pedido-admin pedido-admin--${estado[0]} ${compacto ? 'pedido-admin--compacto' : ''}`}>
      <ul>{productos.map((p, i) => <li key={i}><b>{p.cantidad}×</b> {p.nombre}</li>)}</ul>
      <div className="pedido-admin__estado">
        <span className="pedido-admin__pill">{estado[1]}</span>
        {r.snacks_entregado_at && <span className="pedido-admin__pill pedido-admin__pill--ok">Entregado</span>}
        {r.snacks_descuento > 0 && <span className="mono">socio −{pesos(r.snacks_descuento)}</span>}
      </div>
      {confirmada && (
        <div className="pedido-admin__acciones">
          {estado[0] === 'efectivo' && (
            <button type="button" className="btn btn-primary btn-sm" disabled={trabajando}
              onClick={() => accion('cobrar_pedido', { p_reserva: r.id }, `¿Cobraste ${pesos(r.snacks_total)} en efectivo a ${r.cliente}? Se registrará en la caja del día.`)}>
              Cobrar {pesos(r.snacks_total)}
            </button>
          )}
          {!r.snacks_entregado_at
            ? <button type="button" className="admin-link" disabled={trabajando} onClick={() => accion('entregar_pedido', { p_reserva: r.id, p_entregado: true })}>Marcar entregado</button>
            : <button type="button" className="admin-link" disabled={trabajando} onClick={() => accion('entregar_pedido', { p_reserva: r.id, p_entregado: false })}>Deshacer entrega</button>}
        </div>
      )}
      {error && <p className="admin-note admin-note--error">{error}</p>}
    </div>
  )
}
