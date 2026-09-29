import {
  CFG, db, stripe, json, sitioURL, nuevoFolio, ocupadasDelDia, limpiarVencidas,
  precioPorHoras, validarReserva, inicioMX,
} from './_lib/comun.js'

// POST /api/checkout  →  crea la reservación (apartada 31 min) y la sesión de pago de Stripe.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' })

  const b = req.body || {}
  const problema = validarReserva(b)
  if (problema) return json(res, 400, { error: problema })

  const hora = Number(b.hora)
  const dur = Number(b.duracion)
  const inicio = inicioMX(b.fecha, hora)
  const fin = new Date(inicio.getTime() + dur * 3600000)
  const monto = precioPorHoras(dur) // el precio lo calcula el servidor, nunca el navegador
  const expiraEn = new Date(Date.now() + CFG.HOLD_MIN * 60000)

  try {
    await limpiarVencidas(b.estacion)

    const ocupadas = await ocupadasDelDia(b.estacion, b.fecha)
    for (let h = hora; h < hora + dur; h++) {
      if (ocupadas.includes(h)) return json(res, 409, { error: 'Ese horario ya está ocupado. Elige otro.' })
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
          hora: `${String(hora).padStart(2, '0')}:00`,
          duracion_h: dur,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          monto,
          estado: 'pendiente_pago',
          expires_at: expiraEn.toISOString(),
        })
        .select('id, folio')
        .single()

      if (!error) reserva = data
      else if (error.code === '23P01') return json(res, 409, { error: 'Ese horario acaba de ser reservado. Elige otro.' })
      else if (error.code !== '23505') throw error // 23505 = folio repetido → reintenta
    }
    if (!reserva) throw new Error('No se pudo generar un folio único')

    const sitio = sitioURL(req)
    try {
      const session = await stripe().checkout.sessions.create({
        mode: 'payment',
        locale: 'es-419',
        customer_email: String(b.email).trim().toLowerCase(),
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: monto * 100,
            product_data: {
              name: `Cleofas Game Center · ${b.estacion} · ${dur} h`,
              description: `${b.fecha} de ${hora}:00 a ${hora + dur}:00 · Folio ${reserva.folio}`,
            },
          },
        }],
        payment_intent_data: { description: `Reservación ${reserva.folio}` },
        expires_at: Math.floor(expiraEn.getTime() / 1000),
        metadata: { reservacion_id: reserva.id, folio: reserva.folio },
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
