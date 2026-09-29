import { db, stripe } from './_lib/comun.js'

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
