import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import CuentaMarco from './CuentaMarco'
import { useAuth } from '../../lib/AuthContext'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { api } from '../../lib/reservas'
import { estadoVenta, pesos, METODOS, ORIGENES } from '../../lib/ventas'
import { fechaCorta } from '../../lib/socios'

const CAMPOS = '*, venta_items(id, nombre, cantidad, precio_unit, subtotal), reservaciones!ventas_reservacion_id_fkey(folio, estacion, inicio)'

async function conToken(ruta, cuerpo) {
  const { data } = await supabase.auth.getSession()
  return api(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify(cuerpo) })
}

export function MisPedidos() {
  const { session, loading } = useAuth()
  const [pedidos, setPedidos] = useState(null)
  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('ventas').select(CAMPOS).eq('socio_id', session.user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setPedidos(data ?? []))
  }, [session?.user?.id])
  if (!supabaseReady || (!loading && !session)) return <Navigate to="/cuenta/entrar" replace />
  const activos = (pedidos ?? []).filter((v) => v.estado === 'pendiente' || (v.estado === 'pagada' && v.entrega === 'pendiente'))
  const otros = (pedidos ?? []).filter((v) => !activos.includes(v))
  return (
    <CuentaMarco>
      <div className="tienda-s__head">
        <div><p className="eyebrow">Club Cleofas</p><h1>Mis pedidos</h1></div>
        <Link to="/cuenta/tienda" className="btn btn-primary btn-sm">Ir a la tienda</Link>
      </div>
      {!pedidos ? <div className="cuenta-esqueleto"><div /></div> : pedidos.length === 0 ? (
        <p className="cuenta-muted">Aún no tienes pedidos. Compra en la <Link className="cuenta-link" to="/cuenta/tienda">tienda</Link> o agrega productos al <Link className="cuenta-link" to="/reservar">reservar</Link>.</p>
      ) : (
        <>
          {activos.length > 0 && <section className="cuenta-panel"><h2>En curso</h2><ListaPedidos lista={activos} /></section>}
          {otros.length > 0 && <section className="cuenta-panel"><h2>Historial</h2><ListaPedidos lista={otros} /></section>}
        </>
      )}
    </CuentaMarco>
  )
}

function ListaPedidos({ lista }) {
  return (
    <div className="mis-reservas">
      {lista.map((v) => {
        const [clase, texto] = estadoVenta(v)
        return (
          <Link key={v.id} to={`/cuenta/pedidos/${v.folio}`} className={`mis-reservas__item pedido-s pedido-s--${clase}`}>
            <div>
              <strong>{v.folio}</strong>
              <span className="mis-reservas__cuando">{fechaCorta(v.created_at)} · {ORIGENES[v.origen]}{v.reservaciones ? ` ${v.reservaciones.folio}` : ''}</span>
              <span className="cuenta-muted">{(v.venta_items ?? []).map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}</span>
            </div>
            <div className="mis-reservas__pedido"><b className={clase === 'entregada' || clase === 'pagada' ? 'ok' : clase === 'cancelada' || clase === 'vencida' ? 'mal' : 'efectivo'}>{texto}</b><span>{pesos(v.total)}</span></div>
          </Link>
        )
      })}
    </div>
  )
}

export function DetallePedido() {
  const { folio } = useParams()
  const location = useLocation()
  const { session, loading } = useAuth()
  const [v, setV] = useState(undefined)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const q = new URLSearchParams(location.search)
  const [aviso] = useState(q.get('pago') === 'ok' ? 'Pago recibido. Estamos confirmándolo…' : q.get('pago') === 'cancelado' ? 'No se completó el pago. Puedes intentarlo de nuevo o pagar al recoger.' : q.get('nuevo') ? '¡Pedido creado! Muestra este QR en mostrador.' : '')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('ventas').select(CAMPOS).eq('folio', String(folio).toUpperCase()).maybeSingle()
    setV(data ?? null)
  }, [folio])

  useEffect(() => {
    if (!session?.user?.id) return undefined
    cargar()
    QRCode.toString(String(folio).toUpperCase(), { type: 'svg', margin: 1, color: { dark: '#03050A', light: '#FFFFFF' } }).then(setQr)
    // Al volver de Stripe: si el aviso del webhook tarda, se pregunta directamente
    if (q.get('pago') === 'ok') conToken('/api/pedido', { verificar: folio }).then(cargar).catch(() => {})
    // Tiempo real: el estado cambia cuando lo cobran o entregan en mostrador
    const canal = supabase.channel(`pedido-${folio}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ventas', filter: `folio=eq.${String(folio).toUpperCase()}` }, cargar)
      .subscribe()
    const poll = setInterval(cargar, 20000)
    return () => { supabase.removeChannel(canal); clearInterval(poll) }
  }, [session?.user?.id, folio])

  if (!supabaseReady || (!loading && !session)) return <Navigate to="/cuenta/entrar" replace />

  async function pagarEnLinea() {
    setTrabajando(true); setError('')
    try { const r = await conToken('/api/pedido', { pagar: v.folio }); window.location.href = r.url } catch (e) { setError(e.message); setTrabajando(false) }
  }
  async function cancelar() {
    if (!window.confirm('¿Cancelar este pedido? Se liberan los productos apartados.')) return
    setTrabajando(true); setError('')
    const { error } = await supabase.rpc('cancelar_mi_pedido', { p_venta: v.id })
    setTrabajando(false)
    if (error) setError(error.message); else cargar()
  }

  const [clase, texto] = v ? estadoVenta(v) : ['', '']
  return (
    <CuentaMarco>
      <Link to="/cuenta/pedidos" className="cuenta-link">← Mis pedidos</Link>
      {aviso && <p className="cuenta-ok cuenta-ok--banner">{aviso}</p>}
      {v === undefined ? <div className="cuenta-esqueleto"><div /></div> : !v ? <p className="cuenta-muted">No encontramos ese pedido.</p> : (
        <div className="pedido-det">
          <section className={`pedido-det__qr pedido-det__qr--${clase}`}>
            <span className={`pedido-det__estado`}>{texto}</span>
            <div className="cuenta-qr__img" dangerouslySetInnerHTML={{ __html: qr }} />
            <code>{v.folio}</code>
            <p className="cuenta-muted">
              {v.estado === 'pendiente' ? 'Muestra este código en mostrador para pagar y recoger tu pedido.'
                : v.estado === 'pagada' && v.entrega === 'pendiente' ? 'Pagado. Muestra este código para recoger tu pedido.'
                  : v.estado === 'pagada' ? '¡Entregado! Gracias por tu compra.' : 'Este pedido ya no está activo.'}
            </p>
            {v.estado === 'pendiente' && v.vence_at && <p className="cuenta-nota">Apartado hasta el {fechaCorta(v.vence_at)}</p>}
          </section>
          <section className="cuenta-panel">
            <h2>Detalle</h2>
            <ul className="tienda-s__lineas">
              {(v.venta_items ?? []).map((i) => <li key={i.id}><span>{i.nombre}</span><span>× {i.cantidad}</span><span>{pesos(i.subtotal)}</span></li>)}
            </ul>
            <dl className="booking__cuenta">
              <div><dt>Subtotal</dt><dd>{pesos(v.subtotal)}</dd></div>
              {Number(v.descuento_socio) > 0 && <div><dt>Descuento socio</dt><dd>−{pesos(v.descuento_socio)}</dd></div>}
              {Number(v.descuento_cupon) > 0 && <div><dt>Cupón</dt><dd>−{pesos(v.descuento_cupon)}</dd></div>}
              <div className="booking__cuenta-total"><dt>Total</dt><dd>{pesos(v.total)}</dd></div>
            </dl>
            {v.reservaciones && <p className="cuenta-nota">Va con tu reserva {v.reservaciones.folio} ({v.reservaciones.estacion}, {fechaCorta(v.reservaciones.inicio)}).</p>}
            {v.estado === 'pagada' && <p className="cuenta-nota">Pagado con {METODOS[v.metodo_pago]?.etiqueta} el {fechaCorta(v.pagada_at)}.</p>}
            {v.estado === 'cancelada' && <p className="cuenta-nota">Cancelado: {v.motivo_cancelacion}</p>}
            {error && <p className="admin-login__error">{error}</p>}
            {v.estado === 'pendiente' && (
              <div className="pedido-det__acciones">
                {Number(v.total) >= 10 && <button className="btn btn-primary btn-sm" disabled={trabajando} onClick={pagarEnLinea}>Pagar ahora en línea</button>}
                {!v.reservaciones && <button className="cuenta-link" disabled={trabajando} onClick={cancelar}>Cancelar pedido</button>}
              </div>
            )}
          </section>
        </div>
      )}
    </CuentaMarco>
  )
}
