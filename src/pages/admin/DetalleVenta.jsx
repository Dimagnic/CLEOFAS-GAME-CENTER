import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { cargarVenta, imprimirVenta, estadoVenta, pesos, METODOS, ORIGENES } from '../../lib/ventas'
import { fechaCorta } from '../../lib/socios'
import { MetodoPago, useCobro } from './Cobro'

// Pedido o venta: ver, cobrar en mostrador, entregar, imprimir y cancelar/devolver.
export default function DetalleVenta({ venta: inicial, cfg, onCerrar, onCambio }) {
  const [v, setV] = useState(inicial)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const cobro = useCobro(Number(v.total))
  const [clase, texto] = estadoVenta(v)
  const reservaOk = !v.reservaciones || v.reservaciones.estado === 'confirmada'

  async function recargar() { setV(await cargarVenta({ id: v.id })); onCambio?.() }

  async function rpc(fn, args, despues) {
    setTrabajando(true); setError('')
    const { error } = await supabase.rpc(fn, args)
    setTrabajando(false)
    if (error) return setError(error.message)
    await recargar()
    despues?.()
  }

  async function cobrar() {
    await rpc('cobrar_venta', { p_venta: v.id, p_metodo: cobro.args.metodo, p_recibido: cobro.args.recibido, p_referencia: cobro.args.referencia }, async () => {
      const nueva = await cargarVenta({ id: v.id })
      if (cfg?.auto !== false) imprimirVenta(nueva, cfg).catch(() => {})
    })
  }

  return (
    <div className="admin-modal__backdrop" onClick={onCerrar}>
      <div className="admin-modal admin-modal--ancho venta-det" onClick={(e) => e.stopPropagation()}>
        <div className="venta-det__head">
          <div>
            <p className="eyebrow">{ORIGENES[v.origen]}{v.reservaciones ? ` · reserva ${v.reservaciones.folio} (${v.reservaciones.estacion})` : ''}</p>
            <h3>{v.folio}</h3>
            <p className="mono">{v.cliente || v.socios?.nombre || 'Cliente'}{v.socios?.codigo ? ` · socio ${v.socios.codigo}` : ''} · {fechaCorta(v.created_at)}</p>
          </div>
          <span className={`venta-estado venta-estado--${clase}`}>{texto}</span>
        </div>

        <table className="admin-table">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead>
          <tbody>
            {(v.venta_items ?? []).map((i) => (
              <tr key={i.id}><td>{i.nombre}</td><td>{i.cantidad}</td><td>{pesos(i.precio_unit)}</td><td>{pesos(i.subtotal)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="tienda__totales venta-det__totales">
          <div><dt>Subtotal</dt><dd>{pesos(v.subtotal)}</dd></div>
          {Number(v.descuento_socio) > 0 && <div><dt>Descuento socio</dt><dd>−{pesos(v.descuento_socio)}</dd></div>}
          {Number(v.descuento_cupon) > 0 && <div><dt>Cupón</dt><dd>−{pesos(v.descuento_cupon)}</dd></div>}
          <div className="tienda__total"><dt>Total</dt><dd>{pesos(v.total)}</dd></div>
        </dl>

        {v.estado === 'pagada' && (
          <p className="admin-note">
            Pagado con <b>{METODOS[v.metodo_pago]?.etiqueta}</b> el {fechaCorta(v.pagada_at)}
            {v.metodo_pago === 'efectivo' && v.recibido != null ? ` · recibió ${pesos(v.recibido)}, cambio ${pesos(v.cambio)}` : ''}
            {v.referencia_pago ? ` · ref. ${v.referencia_pago}` : ''}{v.cobrado_por ? ` · ${String(v.cobrado_por).split('@')[0]}` : ''}
          </p>
        )}
        {v.estado === 'cancelada' && <p className="admin-note admin-note--error">Cancelada el {fechaCorta(v.cancelada_at)}: {v.motivo_cancelacion}</p>}

        {v.estado === 'pendiente' && (
          reservaOk ? (
            <div className="venta-det__cobro">
              <h4>Cobrar en mostrador</h4>
              {v.pago_preferido === 'en_linea' && <p className="socio-picker__nota">El cliente eligió pagar en línea y aún no paga. Si prefiere pagar aquí, cóbralo normalmente.</p>}
              <MetodoPago {...cobro.props} />
              <button className="btn btn-primary" disabled={trabajando || !cobro.valido} onClick={cobrar}>
                {trabajando ? 'Cobrando…' : `Cobrar ${pesos(v.total)} · ${METODOS[cobro.args.metodo].corto}`}
              </button>
              <p className="socio-picker__nota">Al cobrar se descuentan las existencias y el socio recibe sus puntos.</p>
            </div>
          ) : <p className="admin-note admin-note--error">La reserva de este pedido no está confirmada (está {v.reservaciones?.estado}). Se cobra cuando la reserva esté pagada.</p>
        )}

        {error && <p className="admin-note admin-note--error">{error}</p>}

        {cancelando ? (
          <form className="venta-det__cancelar" onSubmit={(e) => { e.preventDefault(); rpc('cancelar_venta', { p_venta: v.id, p_motivo: new FormData(e.target).get('motivo') }, () => setCancelando(false)) }}>
            <label>Motivo de la {v.estado === 'pagada' ? 'devolución (regresa existencias, resta puntos; el dinero se devuelve por fuera)' : 'cancelación (libera lo apartado)'}
              <input name="motivo" required minLength={3} autoFocus />
            </label>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCancelando(false)}>Volver</button>
              <button className="btn btn-primary btn-sm" disabled={trabajando}>Confirmar</button>
            </div>
          </form>
        ) : (
          <div className="admin-modal__actions venta-det__acciones">
            {v.estado !== 'cancelada' && (v.entrega === 'entregada'
              ? <button className="admin-link" disabled={trabajando} onClick={() => rpc('entregar_venta', { p_venta: v.id, p_entregada: false })}>Deshacer entrega</button>
              : <button className="btn btn-ghost btn-sm" disabled={trabajando} onClick={() => rpc('entregar_venta', { p_venta: v.id, p_entregada: true })}>Marcar entregado</button>)}
            <button className="btn btn-ghost btn-sm" onClick={() => imprimirVenta(v, cfg)}>{v.estado === 'pagada' ? 'Imprimir ticket' : 'Imprimir comprobante'}</button>
            {v.estado !== 'cancelada' && <button className="admin-link admin-link--peligro" onClick={() => setCancelando(true)}>{v.estado === 'pagada' ? 'Devolver / cancelar' : 'Cancelar pedido'}</button>}
            <button className="btn btn-primary btn-sm" onClick={onCerrar}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}
