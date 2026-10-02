import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { randomInt } from 'node:crypto'
import { CFG, ahoraMX, redondearArriba } from './reglas.js'
export * from './reglas.js'

let _db, _stripe

// Cliente con permisos de servidor (salta RLS). NUNCA se expone al navegador.
export function db() {
  if (!_db) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    _db = createClient(url, key, { auth: { persistSession: false } })
  }
  return _db
}

export function stripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Falta STRIPE_SECRET_KEY')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}

export function sitioURL(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  return `${proto}://${host}`
}

export function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body)
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function nuevoFolio() {
  let s = ''
  for (let i = 0; i < 5; i++) s += ALFABETO[randomInt(ALFABETO.length)]
  return `CL-${s}`
}

// Bloques ocupados de una estación en una fecha, en minutos desde medianoche (hora de Puebla):
//  · reservas pagadas, apartados vigentes y reservas antiguas sin pago
//  · la sesión que el encargado tiene en curso en el panel (hasta que termina, redondeada a 5 min)
//  · la estación en mantenimiento (todo el día de hoy)
// Así la página puede ofrecer el minuto exacto en que se libera cada estación.
export async function bloquesDelDia(estacion, fecha, ahora = Date.now()) {
  const [reservas, est] = await Promise.all([
    db().from('reservaciones')
      .select('hora, duracion_h, estado, expires_at')
      .eq('estacion', estacion).eq('fecha', fecha)
      .in('estado', ['pendiente', 'confirmada', 'pendiente_pago']),
    db().from('estaciones').select('estado, fin_sesion').eq('id', estacion).maybeSingle(),
  ])
  if (reservas.error) throw reservas.error
  if (est.error) throw est.error

  const bloques = []
  for (const r of reservas.data) {
    if (r.estado === 'pendiente_pago' && r.expires_at && new Date(r.expires_at).getTime() < ahora) continue
    const [h, m] = String(r.hora).split(':').map(Number)
    const ini = h * 60 + (m || 0)
    bloques.push({ ini, fin: ini + r.duracion_h * 60 })
  }

  const hoy = ahoraMX(ahora)
  if (fecha === hoy.fecha && est.data) {
    if (est.data.estado === 'mantenimiento') {
      bloques.push({ ini: 0, fin: 24 * 60 })
    } else if (est.data.estado === 'sesion') {
      const finMs = est.data.fin_sesion ? new Date(est.data.fin_sesion).getTime() : 0
      // Si la sesión ya venció y nadie la cerró, asumimos unos minutos más para no empalmar a quien pagó.
      const efectivo = finMs > ahora ? finMs : ahora + CFG.SESION_VENCIDA_MIN * 60000
      const f = ahoraMX(efectivo)
      bloques.push({ ini: 0, fin: f.fecha === fecha ? redondearArriba(f.min) : 24 * 60 })
    }
  }
  return bloques.sort((a, b) => a.ini - b.ini)
}

// Marca como expiradas las reservas con pago pendiente cuyo apartado ya venció.
export async function limpiarVencidas(estacion) {
  await db()
    .from('reservaciones')
    .update({ estado: 'expirada' })
    .eq('estacion', estacion)
    .eq('estado', 'pendiente_pago')
    .lt('expires_at', new Date().toISOString())
}
