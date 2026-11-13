// Ventas, pedidos y cobros: utilidades compartidas por el POS, el panel y la tienda del socio.
import { supabase } from './supabaseClient'
import { imprimirTicket } from './hardware'

export const METODOS = {
  efectivo: { etiqueta: 'Efectivo', corto: 'Efectivo' },
  terminal: { etiqueta: 'Tarjeta (terminal)', corto: 'Terminal' },
  qr: { etiqueta: 'Transferencia / QR', corto: 'QR' },
  en_linea: { etiqueta: 'Pago en línea', corto: 'En línea' },
}
export const ORIGENES = { pos: 'Mostrador', tienda: 'Tienda en línea', reserva: 'Con reserva' }

export const pesos = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

// [clase, texto] del estado de una venta para mostrar
export function estadoVenta(v) {
  if (!v) return ['', '']
  if (v.estado === 'cancelada') return ['cancelada', 'Cancelada']
  if (v.estado === 'pagada') return v.entrega === 'entregada' ? ['entregada', 'Pagada · entregada'] : ['pagada', 'Pagada · por entregar']
  if (v.vence_at && new Date(v.vence_at).getTime() < Date.now()) return ['vencida', 'Venció sin pagar']
  return v.pago_preferido === 'en_linea' ? ['espera', 'Esperando pago en línea'] : ['pendiente', 'Por cobrar en mostrador']
}

const CAMPOS = '*, venta_items(id, producto_id, nombre, precio_unit, cantidad, subtotal), socios(nombre, email, codigo), reservaciones!ventas_reservacion_id_fkey(folio, estacion, inicio, estado)'

export async function cargarVenta({ id, folio }) {
  let q = supabase.from('ventas').select(CAMPOS)
  q = id ? q.eq('id', id) : q.eq('folio', String(folio).trim().toUpperCase())
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  return data
}

export async function listarVentas({ estado, desde, hasta, metodo, origen, limite = 300 } = {}) {
  let q = supabase.from('ventas').select(CAMPOS).order('created_at', { ascending: false }).limit(limite)
  if (estado) q = q.eq('estado', estado)
  if (metodo) q = q.eq('metodo_pago', metodo)
  if (origen) q = q.eq('origen', origen)
  if (desde) q = q.gte('created_at', desde)
  if (hasta) q = q.lt('created_at', hasta)
  const { data, error } = await q
  if (error) throw error
  return data
}

// Puntos que ganó el socio con esa venta (para el ticket)
export async function puntosDeVenta(folio) {
  const { data } = await supabase.from('movimientos').select('puntos').eq('ref', `venta:${folio}`).maybeSingle()
  return data?.puntos ?? 0
}

export async function imprimirVenta(venta, cfg) {
  const puntos = venta.socio_id && venta.estado === 'pagada' ? await puntosDeVenta(venta.folio).catch(() => 0) : 0
  return imprimirTicket({ ...venta, puntos }, venta.venta_items ?? [], cfg)
}

// Inicio del día de hoy en Puebla (ISO)
export function inicioDeHoy(diasAtras = 0) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(Date.now() - diasAtras * 86400000))
  return new Date(`${f}T00:00:00-06:00`).toISOString()
}

// Reconoce lo que lee un escáner: producto, pedido, socio o reserva
export function tipoCodigo(c) {
  const t = String(c).trim().toUpperCase().replace(/^CLEOFAS:/, '')
  if (/^V-[A-Z0-9]{6}$/.test(t)) return { tipo: 'venta', valor: t }
  if (/^S-[A-Z0-9]{6}$/.test(t)) return { tipo: 'socio', valor: t }
  if (/^CL-[A-Z0-9]{4,6}$/.test(t)) return { tipo: 'reserva', valor: t }
  return { tipo: 'producto', valor: String(c).trim() }
}
