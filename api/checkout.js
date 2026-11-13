import {
  CFG, db, stripe, json, sitioURL, nuevoFolio, bloquesDelDia, limpiarVencidas,
  precioPorHoras, validarReserva, inicioMX, chocaConBloques, hhmm,
} from './_lib/comun.js'
import { LEGAL } from '../src/data/negocio.js'
import { enviarConfirmacionSegura } from './_lib/correo.js'

const MINIMO_STRIPE = 10 // Stripe no cobra menos de $10 MXN

// Cupón del socio para horas: suyo, disponible, vigente y sin otra reserva pendiente que lo esté usando.
async function cuponValido(cuponId, socioId, ahora) {
  if (!/^[0-9a-f-]{36}$/i.test(String(cuponId))) return null
  const { data: c } = await db().from('cupones').select('*').eq('id', cuponId).eq('socio_id', socioId).eq('estado', 'disponible').maybeSingle()
  if (!c || (c.vence_at && new Date(c.vence_at).getTime() <= ahora) || !['horas', 'todo'].includes(c.aplica)) return null
  const { data: otras } = await db().from('reservaciones').select('id, expires_at')
    .eq('cupon_id', cuponId).eq('estado', 'pendiente_pago').gt('expires_at', new Date(ahora).toISOString())
  return otras?.length ? null : c
}

// Si quien reserva es socio con sesión iniciada (manda su token), se aplica el descuento de su rango.
// Si algo falla al revisarlo, se cobra el precio normal: nunca bloquea el pago.
async function socioDe(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const { data: u, error } = await db().auth.getUser(token)
    if (error || !u?.user) return null
    const { data: s } = await db().from('socios').select('user_id, rangos(nombre, desc_horas, desc_snacks)').eq('user_id', u.user.id).maybeSingle()
    return s ?? null
  } catch (e) {
    console.warn('No se pudo revisar el socio:', e.message)
    return null
  }
}

// Productos de tienda agregados a la reserva: [{ id, cantidad }] (precios y existencias los valida la base de datos)
function productosValidos(productos) {
  if (!Array.isArray(productos) || productos.length === 0) return null
  if (productos.length > 30) return { error: 'Demasiados productos.' }
  const items = []
  for (const p of productos) {
    const id = String(p?.id ?? '')
    const cantidad = Math.trunc(Number(p?.cantidad))
    if (!/^[0-9a-f-]{36}$/i.test(id) || !(cantidad >= 1 && cantidad <= 20)) return { error: 'Revisa los productos de tu pedido.' }
    items.push({ producto_id: id, cantidad })
  }
  return { items }
}

// POST /api/checkout  →  crea la reservación (apartada 31 min) y la sesión de pago de Stripe.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' })

  const b = req.body || {}

  try {
    const ahora = Date.now()
    const problema = validarReserva(b, ahora)
    if (problema) return json(res, 400, { error: problema })
    if (b.aceptaPoliticas !== true) {
      return json(res, 400, { error: 'Debes aceptar el Aviso de privacidad y la Política de cancelación para continuar.' })
    }

    const ini = Number(b.inicioMin) // minutos desde medianoche (ej. 730 = 12:10)
    const dur = Number(b.duracion)
    const inicio = inicioMX(b.fecha, ini)
    const fin = new Date(inicio.getTime() + dur * 3600000)
    const precioBase = precioPorHoras(dur) // el precio lo calcula el servidor, nunca el navegador
    const socio = await socioDe(req)
    const pct = Math.min(50, Math.max(0, Number(socio?.rangos?.desc_horas) || 0))
    const descuento = Math.round((precioBase * pct) / 100)
    let cupon = null
    let descuentoCupon = 0
    if (b.cuponId && socio) {
      cupon = await cuponValido(b.cuponId, socio.user_id, ahora)
      if (!cupon) return json(res, 400, { error: 'Ese cupón ya no está disponible. Quítalo e intenta de nuevo.' })
      const base = precioBase - descuento
      descuentoCupon = Math.min(base, cupon.tipo === 'porcentaje' ? Math.round((base * Number(cupon.valor)) / 100) : Number(cupon.valor))
    }
    // Pedido de tienda (opcional): se paga EN LÍNEA con la reserva o PRESENCIAL (efectivo, terminal o QR) al llegar
    const pedido = productosValidos(b.productos)
    if (pedido?.error) return json(res, 400, { error: pedido.error })
    const pagoProductos = pedido ? (b.pagoProductos === 'en_linea' ? 'en_linea' : ['presencial', 'efectivo'].includes(b.pagoProductos) ? 'presencial' : null) : null
    if (pedido && !pagoProductos) return json(res, 400, { error: 'Elige cómo quieres pagar tus productos: en línea o al llegar.' })

    let montoHoras = precioBase - descuento - descuentoCupon
    // Si con el cupón las horas quedan en menos del mínimo de Stripe, el resto también va por cuenta del cupón.
    if (cupon && montoHoras < MINIMO_STRIPE && pagoProductos !== 'en_linea') { descuentoCupon += montoHoras; montoHoras = 0 }
    const expiraEn = new Date(ahora + CFG.HOLD_MIN * 60000)

    await limpiarVencidas(b.estacion)

    // Reservas, sesión en curso en el panel y mantenimiento: nada se puede empalmar.
    const bloques = await bloquesDelDia(b.estacion, b.fecha, ahora)
    if (chocaConBloques(ini, dur * 60, bloques)) {
      return json(res, 409, { error: 'Ese horario ya está ocupado. Elige otro.' })
    }

    // Insert con folio único. La restricción de la base de datos rechaza traslapes (23P01)
    // aunque dos personas intenten pagar el mismo horario al mismo tiempo.
    let reserva = null
    for (let intento = 0; intento < 5 && !reserva; intento++) {
      const { data, error } = await db()
        .from('reservaciones')
        .insert({
          folio: nuevoFolio(),
          cliente: String(b.cliente).trim(),
          email: String(b.email).trim().toLowerCase(),
          telefono: String(b.telefono ?? '').replace(/\D/g, '') || null,
          estacion: b.estacion,
          fecha: b.fecha,
          hora: hhmm(ini),
          duracion_h: dur,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          monto: montoHoras,
          estado: 'pendiente_pago',
          expires_at: expiraEn.toISOString(),
          ...(socio ? { socio_id: socio.user_id, descuento } : {}),
          ...(cupon ? { cupon_id: cupon.id, descuento_cupon: descuentoCupon } : {}),
        })
        .select('id, folio')
        .single()

      if (!error) reserva = data
      else if (error.code === '23P01') return json(res, 409, { error: 'Ese horario acaba de ser reservado. Elige otro.' })
      else if (error.code !== '23505') throw error // 23505 = folio repetido → reintenta
    }
    if (!reserva) throw new Error('No se pudo generar un folio único')

    // El pedido se crea como venta pendiente (aparta existencias). Se paga con la reserva o al llegar.
    let venta = null
    if (pedido) {
      const { data, error } = await db().rpc('crear_pedido', {
        p_socio: socio?.user_id ?? null, p_items: pedido.items, p_pago_preferido: pagoProductos, p_cupon: null,
        p_reservacion: reserva.id,
        p_vence: pagoProductos === 'en_linea' ? expiraEn.toISOString() : new Date(fin.getTime() + 6 * 3600000).toISOString(),
        p_cliente: String(b.cliente).trim(),
      })
      if (error) {
        await db().from('reservaciones').update({ estado: 'cancelada' }).eq('id', reserva.id)
        return json(res, error.code === 'P0001' ? 409 : 500, { error: error.code === 'P0001' ? error.message : 'No pudimos apartar tus productos.' })
      }
      venta = data
    }
    const productosEnLinea = venta && pagoProductos === 'en_linea' ? Number(venta.total) : 0
    const monto = montoHoras + productosEnLinea // lo que se cobra en línea ahora
    if (monto > 0 && monto < MINIMO_STRIPE) {
      await db().from('reservaciones').update({ estado: 'cancelada' }).eq('id', reserva.id)
      return json(res, 400, { error: `El pago en línea mínimo es de $${MINIMO_STRIPE}. Elige pagar tus productos al llegar.` })
    }
    if (venta) {
      // Campos de resumen (correo y consulta de folio)
      await db().from('reservaciones').update({
        monto, snacks_total: venta.total, snacks_subtotal: venta.subtotal, snacks_descuento: venta.descuento_socio,
        snacks_pago: pagoProductos === 'en_linea' ? 'en_linea' : 'efectivo',
      }).eq('id', reserva.id)
    }

    const sitio = sitioURL(req)
    const volver = b.volver === '/reservar' ? '/reservar' : '/'

    // Cubierta por completo con cupón: se confirma sin pasar por Stripe (la base canjea el cupón y suma puntos).
    if (monto === 0) {
      const { error } = await db().from('reservaciones')
        .update({ estado: 'confirmada', paid_at: new Date().toISOString(), expires_at: null })
        .eq('id', reserva.id).eq('estado', 'pendiente_pago')
      if (error) throw error
      await enviarConfirmacionSegura(reserva.id, sitio)
      return json(res, 200, { url: `${sitio}${volver}?pago=ok&folio=${reserva.folio}${volver === '/' ? '#reservar' : ''}`, folio: reserva.folio, gratis: true })
    }

    try {
      const session = await stripe().checkout.sessions.create({
        mode: 'payment',
        locale: 'es-419',
        customer_email: String(b.email).trim().toLowerCase(),
        line_items: [
          ...(montoHoras > 0 ? [{
            quantity: 1,
            price_data: {
              currency: 'mxn',
              unit_amount: Math.round(montoHoras * 100),
              product_data: {
                name: `Cleofas Game Center · ${b.estacion} · ${dur} h${descuento ? ` · socio ${socio.rangos?.nombre ?? ''} -${pct}%` : ''}${cupon ? ` · cupón ${cupon.codigo}` : ''}`,
                description: `${b.fecha} de ${hhmm(ini)} a ${hhmm(ini + dur * 60)} · Folio ${reserva.folio}`,
              },
            },
          }] : []),
          ...(productosEnLinea > 0 ? [{
            quantity: 1,
            price_data: {
              currency: 'mxn',
              unit_amount: Math.round(productosEnLinea * 100),
              product_data: {
                name: `Productos de tienda · pedido ${venta.folio}${Number(venta.descuento_socio) ? ' (descuento de socio)' : ''}`,
                description: `Se entregan en tu visita. Folio ${venta.folio}`,
              },
            },
          }] : []),
        ],
        payment_intent_data: { description: `Reservación ${reserva.folio}` },
        expires_at: Math.floor(expiraEn.getTime() / 1000),
        // Queda registrado en Stripe qué versión de las políticas aceptó el cliente.
        metadata: { reservacion_id: reserva.id, folio: reserva.folio, politicas_version: LEGAL.version },
        success_url: `${sitio}${volver}?pago=ok&folio=${reserva.folio}${volver === '/' ? '#reservar' : ''}`,
        cancel_url: `${sitio}${volver}?pago=cancelado&folio=${reserva.folio}${volver === '/' ? '#reservar' : ''}`,
      })

      await db().from('reservaciones').update({ stripe_session_id: session.id }).eq('id', reserva.id)
      return json(res, 200, { url: session.url, folio: reserva.folio })
    } catch (e) {
      console.error('stripe checkout', e)
      await db().from('reservaciones').update({ estado: 'cancelada' }).eq('id', reserva.id)
      return json(res, 502, { error: 'No pudimos iniciar el pago. Intenta de nuevo.' })
    }
  } catch (e) {
    console.error('checkout', e)
    return json(res, 500, { error: 'No pudimos crear tu reservación. Intenta de nuevo.' })
  }
}
