import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { randomInt } from 'node:crypto'
import { CFG } from './reglas.js'

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

// Horas (11..22) que ya están ocupadas para una estación en una fecha.
// Cuenta reservas pagadas, apartados vigentes y reservas antiguas sin pago.
export async function ocupadasDelDia(estacion, fecha) {
  const { data, error } = await db()
    .from('reservaciones')
    .select('hora, duracion_h, estado, expires_at')
    .eq('estacion', estacion)
    .eq('fecha', fecha)
    .in('estado', ['pendiente', 'confirmada', 'pendiente_pago'])
  if (error) throw error

  const ahora = Date.now()
  const ocupadas = new Set()
  for (const r of data) {
    if (r.estado === 'pendiente_pago' && r.expires_at && new Date(r.expires_at).getTime() < ahora) continue
    const [h, m] = String(r.hora).split(':').map(Number)
    const ini = h * 60 + (m || 0)
    const fin = ini + r.duracion_h * 60
    for (let H = CFG.HORA_ABRE; H < CFG.HORA_CIERRA; H++) {
      if (H * 60 < fin && (H + 1) * 60 > ini) ocupadas.add(H)
    }
  }
  return [...ocupadas].sort((a, b) => a - b)
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
