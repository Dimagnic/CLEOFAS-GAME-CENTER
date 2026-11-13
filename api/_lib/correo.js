import { db } from './comun.js'
import { armarCorreo } from './plantillaCorreo.js'

// Envía la confirmación con Resend (https://resend.com). Variables en Vercel:
//   RESEND_API_KEY  (obligatoria; sin ella no se envía nada y las reservas funcionan igual)
//   EMAIL_FROM      ej. "Cleofas Game Center <reservas@tudominio.mx>" (requiere dominio verificado en Resend)
//   EMAIL_COPIA     (opcional) correo del negocio que recibe copia de cada reservación pagada
export async function enviarConfirmacion(reservacionId, sitio) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('Correo de confirmación omitido: falta RESEND_API_KEY')
    return false
  }

  const { data: r, error } = await db().from('reservaciones').select('*').eq('id', reservacionId).maybeSingle()
  if (error || !r) throw error ?? new Error('Reservación no encontrada')
  if (!r.email) return false
  const { data: est } = await db().from('estaciones').select('id, tipo, specs').eq('id', r.estacion).maybeSingle()

  // Pedido de tienda de la reserva (tabla de ventas; las reservas anteriores usaban reserva_productos)
  let productos = []
  if (r.venta_id) {
    const { data } = await db().from('venta_items').select('nombre, cantidad, precio_unit').eq('venta_id', r.venta_id)
    productos = data ?? []
    const { data: v } = await db().from('ventas').select('folio, total, pago_preferido').eq('id', r.venta_id).maybeSingle()
    if (v) Object.assign(r, { snacks_total: v.total, snacks_pago: v.pago_preferido === 'en_linea' ? 'en_linea' : 'efectivo', venta_folio: v.folio })
  } else {
    const { data } = await db().from('reserva_productos').select('nombre, cantidad, precio_unit').eq('reservacion_id', r.id)
    productos = data ?? []
  }
  const { asunto, html, texto } = armarCorreo(r, est, sitio, productos)
  const copia = (process.env.EMAIL_COPIA || '').trim()

  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 8000)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Cleofas Game Center <onboarding@resend.dev>',
        to: [r.email],
        ...(copia ? { bcc: [copia] } : {}),
        subject: asunto,
        html,
        text: texto,
      }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return true
  } finally {
    clearTimeout(t)
  }
}

// Nunca rompe el pago ni la confirmación: si el correo falla solo queda en los registros.
export async function enviarConfirmacionSegura(reservacionId, sitio) {
  try {
    return await enviarConfirmacion(reservacionId, sitio)
  } catch (e) {
    console.error('No se pudo enviar el correo de confirmación:', e.message)
    return false
  }
}
