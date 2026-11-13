import { useEffect, useState } from 'react'
import { estadoVenta, pesos, cargarVenta } from '../../lib/ventas'
import DetalleVenta from './DetalleVenta'
import { cargarConfigTicket } from './Hardware'

// Pedido de tienda ligado a una reserva (r.venta). Resumen + botón para cobrar/entregar en el detalle.
export function estadoPedido(r) {
  return r?.venta ? estadoVenta(r.venta) : null
}

export default function PedidoAdmin({ r, onCambio, compacto = false }) {
  const [abierta, setAbierta] = useState(null)
  const [cfg, setCfg] = useState({})
  useEffect(() => { if (abierta) cargarConfigTicket().then(setCfg) }, [abierta])
  const v = r?.venta
  if (!v) return compacto ? <span className="mono">—</span> : null
  const [clase, texto] = estadoVenta(v)
  return (
    <div className={`pedido-admin pedido-admin--${clase} ${compacto ? 'pedido-admin--compacto' : ''}`}>
      <ul>{(v.venta_items ?? []).map((i, n) => <li key={i.id ?? n}><b>{i.cantidad}×</b> {i.nombre}</li>)}</ul>
      <div className="pedido-admin__estado">
        <span className="pedido-admin__pill">{texto}</span>
        <span className="mono">{pesos(v.total)} · {v.folio}</span>
      </div>
      <div className="pedido-admin__acciones">
        <button type="button" className={v.estado === 'pendiente' ? 'btn btn-primary btn-sm' : 'admin-link'}
          onClick={async () => setAbierta(await cargarVenta({ id: v.id }))}>
          {v.estado === 'pendiente' ? `Cobrar ${pesos(v.total)}` : v.entrega === 'pendiente' && v.estado === 'pagada' ? 'Entregar' : 'Ver pedido'}
        </button>
      </div>
      {abierta && <DetalleVenta venta={abierta} cfg={cfg} onCerrar={() => setAbierta(null)} onCambio={onCambio} />}
    </div>
  )
}
