import { db, stripe, json, sitioURL } from './_lib/comun.js'
import { enviarConfirmacionSegura } from './_lib/correo.js'

const CAMPOS = 'id, folio, cliente, estacion, fecha, hora, duracion_h, estado, monto, stripe_session_id, expires_at, snacks_total, snacks_pago, snacks_estado, venta_id'

function publica(r) {
  return {
    folio: r.folio,
    cliente: String(r.cliente).split(' ')[0], // solo el primer nombre: el folio es lo único que protege estos datos
    estacion: r.estacion,
    fecha: r.fecha,
    hora: String(r.hora).slice(0, 5),
    duracionH: r.duracion_h,
    estado: r.estado,
    monto: r.monto,
    pedido: r.snacks_pago ? {
      productos: (r.productos ?? []).map((p) => ({ nombre: p.nombre, cantidad: p.cantidad })),
      total: Number(r.snacks_total),
      pago: r.snacks_pago,
      pagado: r.snacks_estado === 'pagado',
      folio: r.venta_folio ?? null,
    } : null,
  }
}

// GET  /api/reservation?folio=CL-XXXXX   → estado de la reservación (y confirma el pago si Stripe ya cobró)
// POST /api/reservation {folio}          → libera el horario si el cliente canceló el pago
export default async function handler(req, res) {
  const folio = String((req.method === 'GET' ? req.query.folio : req.body?.folio) ?? '').trim().toUpperCase()
  if (!/^CL-[A-Z0-9]{4,6}$/.test(folio)) return json(res, 400, { error: 'Folio inválido' })

  try {
    const { data: r, error } = await db().from('reservaciones').select(CAMPOS).eq('folio', folio).maybeSingle()
    if (error) throw error
    if (!r) return json(res, 404, { error: 'No encontramos ese folio.' })
    if (r.venta_id) {
      const { data: v } = await db().from('ventas').select('folio, total, estado, pago_preferido, venta_items(nombre, cantidad)').eq('id', r.venta_id).maybeSingle()
      if (v) Object.assign(r, { productos: v.venta_items, snacks_total: v.total, snacks_pago: v.pago_preferido === 'en_linea' ? 'en_linea' : 'efectivo', snacks_estado: v.estado === 'pagada' ? 'pagado' : 'pendiente', venta_folio: v.folio })
    } else if (r.snacks_pago) {
      const { data: productos } = await db().from('reserva_productos').select('nombre, cantidad').eq('reservacion_id', r.id).order('nombre')
      r.productos = productos ?? []
    }

    if (req.method === 'POST') {
      if (r.estado === 'pendiente_pago') {
        try { if (r.stripe_session_id) await stripe().checkout.sessions.expire(r.stripe_session_id) } catch {}
        await db().from('reservaciones').update({ estado: 'expirada' }).eq('id', r.id).eq('estado', 'pendiente_pago')
        r.estado = 'expirada'
      }
      return json(res, 200, publica(r))
    }

    if (r.estado === 'pendiente_pago') {
      if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) {
        await db().from('reservaciones').update({ estado: 'expirada' }).eq('id', r.id).eq('estado', 'pendiente_pago')
        r.estado = 'expirada'
      } else if (r.stripe_session_id) {
        // Respaldo por si el webhook tarda: preguntamos a Stripe directamente.
        const s = await stripe().checkout.sessions.retrieve(r.stripe_session_id)
        if (s.payment_status === 'paid') {
          const { data: actualizadas } = await db()
            .from('reservaciones')
            .update({ estado: 'confirmada', paid_at: new Date().toISOString(), stripe_payment_intent_id: s.payment_intent })
            .eq('id', r.id)
            .eq('estado', 'pendiente_pago')
            .select('id')
          r.estado = 'confirmada'
          if (r.snacks_pago === 'en_linea') r.snacks_estado = 'pagado'
          if (actualizadas?.length) await enviarConfirmacionSegura(r.id, sitioURL(req)) // si el webhook no llegó primero
        }
      }
    }
    return json(res, 200, publica(r))
  } catch (e) {
    console.error('reservation', e)
    return json(res, 500, { error: 'No pudimos consultar tu reservación.' })
  }
}
