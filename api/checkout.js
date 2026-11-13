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

// Productos de tienda agregados a la reserva. Precios y descuento los calcula el servidor.
// Devuelve { lineas, subtotal, descuento, total } o { error }.
async function armarPedido(productos, pctSnacks) {
  if (!Array.isArray(productos) || productos.length === 0) return null
  const cantidades = new Map()
  for (const p of productos.slice(0, 30)) {
    const id = String(p?.id ?? '')
    const cant = Math.trunc(Number(p?.cantidad))
    if (!/^[0-9a-f-]{36}$/i.test(id) || !(cant >= 1)) return { error: 'Revisa los productos de tu pedido.' }
    cantidades.set(id, Math.min(20, (cantidades.get(id) ?? 0) + cant))
  }
  if (cantidades.size > 15) return { error: 'Puedes agregar hasta 15 productos distintos.' }
  const { data, error } = await db().from('productos').select('id, nombre, precio').in('id', [...cantidades.keys()]).eq('activo', true)
  if (error) throw error
  if (data.length !== cantidades.size) return { error: 'Algún producto de tu pedido ya no está disponible. Actualiza la página.' }
  const lineas = data.map((p) => ({ producto_id: p.id, nombre: p.nombre, precio_unit: Number(p.precio), cantidad: cantidades.get(p.id) }))
  const subtotal = lineas.reduce((s, l) => s + l.precio_unit * l.cantidad, 0)
  const descuento = Math.round((subtotal * pctSnacks) / 100)
  return { lineas, subtotal, descuento, total: subtotal - descuento }
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
    // Pedido de tienda (opcional) y cómo lo paga: junto con la reserva o en efectivo el día de la visita
    const pedido = await armarPedido(b.productos, Math.min(50, Math.max(0, Number(socio?.rangos?.desc_snacks) || 0)))
    if (pedido?.error) return json(res, 400, { error: pedido.error })
    const pagoProductos = pedido ? b.pagoProductos : null
    if (pedido && !['en_linea', 'efectivo'].includes(pagoProductos)) {
      return json(res, 400, { error: 'Elige cómo quieres pagar tus productos: en línea o en efectivo en tu visita.' })
    }
    const productosEnLinea = pagoProductos === 'en_linea' ? pedido.total : 0

    let montoHoras = precioBase - descuento - descuentoCupon
    // Si con el cupón las horas quedan en menos del mínimo de Stripe, el resto también va por cuenta del cupón.
    if (cupon && montoHoras < MINIMO_STRIPE && productosEnLinea === 0) { descuentoCupon += montoHoras; montoHoras = 0 }
    const monto = montoHoras + productosEnLinea // lo que se cobra en línea ahora
    if (monto > 0 && monto < MINIMO_STRIPE) {
      return json(res, 400, { error: `El pago en línea mínimo es de $${MINIMO_STRIPE}. Elige pagar tus productos en efectivo en tu visita.` })
    }
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
          monto,
          estado: 'pendiente_pago',
          expires_at: expiraEn.toISOString(),
          ...(socio ? { socio_id: socio.user_id, descuento } : {}),
          ...(cupon ? { cupon_id: cupon.id, descuento_cupon: descuentoCupon } : {}),
          ...(pedido ? {
            snacks_subtotal: pedido.subtotal, snacks_descuento: pedido.descuento, snacks_total: pedido.total,
            snacks_pago: pagoProductos, snacks_estado: 'pendiente',
          } : {}),
        })
        .select('id, folio')
        .single()

      if (!error) reserva = data
      else if (error.code === '23P01') return json(res, 409, { error: 'Ese horario acaba de ser reservado. Elige otro.' })
      else if (error.code !== '23505') throw error // 23505 = folio repetido → reintenta
    }
    if (!reserva) throw new Error('No se pudo generar un folio único')

    if (pedido) {
      const { error } = await db().from('reserva_productos').insert(pedido.lineas.map((l) => ({ ...l, reservacion_id: reserva.id })))
      if (error) {
        await db().from('reservaciones').update({ estado: 'cancelada' }).eq('id', reserva.id)
        throw error
      }
    }

    const sitio = sitioURL(req)

    // Cubierta por completo con cupón: se confirma sin pasar por Stripe (la base canjea el cupón y suma puntos).
    if (monto === 0) {
      const { error } = await db().from('reservaciones')
        .update({ estado: 'confirmada', paid_at: new Date().toISOString(), expires_at: null })
        .eq('id', reserva.id).eq('estado', 'pendiente_pago')
      if (error) throw error
      await enviarConfirmacionSegura(reserva.id, sitio)
      return json(res, 200, { url: `${sitio}/?pago=ok&folio=${reserva.folio}#reservar`, folio: reserva.folio, gratis: true })
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
                name: `Productos de tienda${pedido.descuento ? ' (descuento de socio)' : ''}`,
                description: pedido.lineas.map((l) => `${l.cantidad}× ${l.nombre}`).join(', ').slice(0, 480),
              },
            },
          }] : []),
        ],
        payment_intent_data: { description: `Reservación ${reserva.folio}` },
        expires_at: Math.floor(expiraEn.getTime() / 1000),
        // Queda registrado en Stripe qué versión de las políticas aceptó el cliente.
        metadata: { reservacion_id: reserva.id, folio: reserva.folio, politicas_version: LEGAL.version },
        success_url: `${sitio}/?pago=ok&folio=${reserva.folio}#reservar`,
        cancel_url: `${sitio}/?pago=cancelado&folio=${reserva.folio}#reservar`,
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
