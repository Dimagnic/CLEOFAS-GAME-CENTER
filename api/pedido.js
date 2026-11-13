import { db, stripe, json, sitioURL } from './_lib/comun.js'

const MINIMO_STRIPE = 10
const HOLD_MIN = 31

// Socio dueño del token de sesión (la tienda en línea es para socios)
async function socioDe(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data: u, error } = await db().auth.getUser(token)
  if (error || !u?.user) return null
  const { data } = await db().from('socios').select('user_id, nombre, email').eq('user_id', u.user.id).maybeSingle()
  return data ?? null
}

function itemsValidos(items) {
  if (!Array.isArray(items) || !items.length || items.length > 30) return null
  const limpios = []
  for (const it of items) {
    const id = String(it?.id ?? it?.producto_id ?? '')
    const cantidad = Math.trunc(Number(it?.cantidad))
    if (!/^[0-9a-f-]{36}$/i.test(id) || !(cantidad >= 1 && cantidad <= 20)) return null
    limpios.push({ producto_id: id, cantidad })
  }
  return limpios
}

async function sesionStripe(venta, items, socio, sitio) {
  const vence = new Date(Date.now() + HOLD_MIN * 60000)
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    locale: 'es-419',
    customer_email: socio.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'mxn',
        unit_amount: Math.round(Number(venta.total) * 100),
        product_data: {
          name: `Pedido ${venta.folio} · Cleofas Game Center`,
          description: items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ').slice(0, 480),
        },
      },
    }],
    payment_intent_data: { description: `Pedido ${venta.folio}` },
    expires_at: Math.floor(vence.getTime() / 1000),
    metadata: { venta_id: venta.id, folio: venta.folio },
    success_url: `${sitio}/cuenta/pedidos/${venta.folio}?pago=ok`,
    cancel_url: `${sitio}/cuenta/pedidos/${venta.folio}?pago=cancelado`,
  })
  await db().from('ventas').update({ stripe_session_id: session.id, vence_at: vence.toISOString() }).eq('id', venta.id)
  return session.url
}

// POST /api/pedido   (socio con sesión iniciada)
//   { items: [{id, cantidad}], pago: 'en_linea' | 'presencial', cuponId? }  → crea el pedido
//   { pagar: 'V-XXXXXX' }      → nuevo enlace de pago en línea para un pedido pendiente
//   { verificar: 'V-XXXXXX' }  → revisa con Stripe si ya se pagó (por si el webhook tarda)
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' })
  const socio = await socioDe(req).catch(() => null)
  if (!socio) return json(res, 401, { error: 'Inicia sesión como socio para comprar en la tienda.' })
  const b = req.body || {}
  const sitio = sitioURL(req)

  try {
    await db().rpc('liberar_pedidos_vencidos')

    if (b.pagar || b.verificar) {
      const { data: v } = await db().from('ventas').select('*, venta_items(nombre, cantidad)').eq('folio', String(b.pagar || b.verificar).toUpperCase()).eq('socio_id', socio.user_id).maybeSingle()
      if (!v) return json(res, 404, { error: 'Pedido no encontrado' })
      if (b.verificar) {
        if (v.estado === 'pendiente' && v.stripe_session_id) {
          const s = await stripe().checkout.sessions.retrieve(v.stripe_session_id)
          if (s.payment_status === 'paid') await db().rpc('confirmar_pago_en_linea', { p_venta: v.id, p_referencia: String(s.payment_intent ?? '') })
        }
        const { data: actual } = await db().from('ventas').select('folio, estado').eq('id', v.id).single()
        return json(res, 200, actual)
      }
      if (v.estado !== 'pendiente') return json(res, 400, { error: 'Este pedido ya no está pendiente de pago.' })
      if (Number(v.total) < MINIMO_STRIPE) return json(res, 400, { error: `El pago en línea mínimo es de $${MINIMO_STRIPE}. Págalo en mostrador.` })
      await db().from('ventas').update({ pago_preferido: 'en_linea' }).eq('id', v.id)
      return json(res, 200, { folio: v.folio, url: await sesionStripe(v, v.venta_items, socio, sitio) })
    }

    const items = itemsValidos(b.items)
    if (!items) return json(res, 400, { error: 'Revisa los productos de tu carrito.' })
    if (!['en_linea', 'presencial'].includes(b.pago)) return json(res, 400, { error: 'Elige cómo quieres pagar.' })
    const cupon = b.cuponId && /^[0-9a-f-]{36}$/i.test(b.cuponId) ? b.cuponId : null

    const { data: venta, error } = await db().rpc('crear_pedido', {
      p_socio: socio.user_id, p_items: items, p_pago_preferido: b.pago, p_cupon: cupon,
      p_reservacion: null, p_vence: b.pago === 'en_linea' ? new Date(Date.now() + HOLD_MIN * 60000).toISOString() : null, p_cliente: socio.nombre,
    })
    if (error) return json(res, error.code === 'P0001' ? 409 : 500, { error: error.code === 'P0001' ? error.message : 'No pudimos crear tu pedido.' })

    if (b.pago === 'presencial') return json(res, 200, { folio: venta.folio })

    if (Number(venta.total) === 0) { // cubierto con cupón
      await db().rpc('confirmar_pago_en_linea', { p_venta: venta.id, p_referencia: 'cupón' })
      return json(res, 200, { folio: venta.folio })
    }
    if (Number(venta.total) < MINIMO_STRIPE) {
      await db().rpc('cancelar_venta_sistema', { p_venta: venta.id, p_motivo: 'Total menor al mínimo de pago en línea' })
      return json(res, 400, { error: `El pago en línea mínimo es de $${MINIMO_STRIPE}. Elige pagar en mostrador o agrega más productos.` })
    }
    const { data: lineas } = await db().from('venta_items').select('nombre, cantidad').eq('venta_id', venta.id)
    try {
      return json(res, 200, { folio: venta.folio, url: await sesionStripe(venta, lineas ?? [], socio, sitio) })
    } catch (e) {
      console.error('stripe pedido', e)
      await db().rpc('cancelar_venta_sistema', { p_venta: venta.id, p_motivo: 'No se pudo iniciar el pago' })
      return json(res, 502, { error: 'No pudimos iniciar el pago. Intenta de nuevo o elige pagar en mostrador.' })
    }
  } catch (e) {
    console.error('pedido', e)
    return json(res, 500, { error: 'No pudimos procesar tu pedido. Intenta de nuevo.' })
  }
}
