import { db, stripe, sitioURL } from './_lib/comun.js'
import { enviarConfirmacionSegura } from './_lib/correo.js'

// Stripe firma el cuerpo EXACTO de la petición, así que lo leemos sin parsear.
export const config = { api: { bodyParser: false } }

async function cuerpoCrudo(req) {
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks)
}

// POST /api/stripe-webhook  ← Stripe avisa aquí cuando un pago se completa o vence.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let event
  try {
    event = stripe().webhooks.constructEvent(
      await cuerpoCrudo(req),
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (e) {
    console.error('Firma de webhook inválida:', e.message)
    return res.status(400).send('Firma inválida')
  }

  try {
    const s = event.data.object
    // Pedido de la tienda en línea (sin reserva)
    const ventaId = s.metadata?.venta_id
    if (ventaId) {
      if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && s.payment_status === 'paid') {
        const { error } = await db().rpc('confirmar_pago_en_linea', { p_venta: ventaId, p_referencia: String(s.payment_intent ?? '') })
        if (error) console.warn(`Pago de pedido ${ventaId} no se pudo confirmar: ${error.message}. Revisar en Stripe.`)
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        const { data: v } = await db().from('ventas').select('estado, stripe_session_id').eq('id', ventaId).maybeSingle()
        // Solo si sigue pendiente y es la misma sesión (el socio pudo haber pedido otro enlace)
        if (v?.estado === 'pendiente' && v.stripe_session_id === s.id) {
          await db().rpc('cancelar_venta_sistema', { p_venta: ventaId, p_motivo: 'El pago en línea no se completó' })
        }
      }
    }
    const id = s.metadata?.reservacion_id
    if (id) {
      if (
        (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') &&
        s.payment_status === 'paid'
      ) {
        const { data } = await db()
          .from('reservaciones')
          .update({ estado: 'confirmada', paid_at: new Date().toISOString(), stripe_payment_intent_id: s.payment_intent })
          .eq('id', id)
          .eq('estado', 'pendiente_pago')
          .select('id')
        // Si no se actualizó nada, el pago llegó cuando el apartado ya se había liberado: reembolsar a mano.
        if (!data?.length) console.warn(`Pago recibido para reservación ${id} que ya no estaba pendiente; revisar en Stripe`)
        else await enviarConfirmacionSegura(id, sitioURL(req)) // solo la primera vez que pasa a pagada
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        await db().from('reservaciones').update({ estado: 'expirada' }).eq('id', id).eq('estado', 'pendiente_pago')
      }
    }
    return res.status(200).json({ received: true })
  } catch (e) {
    console.error('webhook', e)
    return res.status(500).send('Error procesando el evento') // Stripe reintenta
  }
}
