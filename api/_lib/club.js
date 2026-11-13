// Funciones del servidor para el Club Cleofas (correos masivos, permisos del equipo).
import { db } from './comun.js'
import { correoCupones } from './plantillaClub.js'

const REMITENTE = () => process.env.EMAIL_FROM || 'Cleofas Game Center <onboarding@resend.dev>'

// Envía hasta 100 correos por petición con la API de lotes de Resend. Devuelve cuántos se enviaron.
export async function enviarLote(mensajes) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('Correos omitidos: falta RESEND_API_KEY'); return 0 }
  let enviados = 0
  for (let i = 0; i < mensajes.length; i += 100) {
    const lote = mensajes.slice(i, i + 100).map((m) => ({ from: REMITENTE(), to: [m.to], subject: m.asunto, html: m.html, text: m.texto }))
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lote),
    })
    if (!res.ok) {
      console.error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`)
      break // probablemente se acabó la cuota del día; lo que falte se intenta en la siguiente corrida
    }
    enviados += lote.length
  }
  return enviados
}

// Avisa por correo de los cupones nuevos (de reglas automáticas o emitidos desde el panel).
// Un solo correo por socio aunque tenga varios cupones nuevos.
export async function avisarCuponesPendientes(sitio) {
  const desde = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data, error } = await db()
    .from('cupones')
    .select('id, codigo, titulo, descripcion, tipo, valor, aplica, vence_at, origen, socio_id, socios(nombre, email, acepta_correos)')
    .is('notificado_at', null)
    .eq('estado', 'disponible')
    .gte('created_at', desde)
    .order('created_at')
    .limit(500)
  if (error) throw error

  const porSocio = new Map()
  for (const c of data) {
    if (!porSocio.has(c.socio_id)) porSocio.set(c.socio_id, { socio: c.socios, cupones: [] })
    porSocio.get(c.socio_id).cupones.push(c)
  }
  const mensajes = []
  const avisados = []
  for (const { socio, cupones } of porSocio.values()) {
    if (socio?.acepta_correos && socio.email) {
      mensajes.push({ to: socio.email, ...correoCupones(socio, cupones, sitio) })
      avisados.push(...cupones.map((c) => c.id))
    } else {
      avisados.push(...cupones.map((c) => c.id)) // no quiere correos: se marca igual para no revisarlo otra vez
    }
  }
  const enviados = await enviarLote(mensajes)
  // Si Resend no envió todo (cuota), solo marcamos los que sí salieron (los de socios sin correo siempre).
  const sinCorreo = data.filter((c) => !(c.socios?.acepta_correos && c.socios?.email)).map((c) => c.id)
  const marcar = enviados >= mensajes.length ? avisados : [...sinCorreo, ...mensajesIds(porSocio, enviados)]
  if (marcar.length) await db().from('cupones').update({ notificado_at: new Date().toISOString() }).in('id', marcar)
  return { cupones: data.length, correos: enviados }
}

function mensajesIds(porSocio, enviados) {
  const ids = []
  let n = 0
  for (const { socio, cupones } of porSocio.values()) {
    if (!(socio?.acepta_correos && socio.email)) continue
    if (n++ >= enviados) break
    ids.push(...cupones.map((c) => c.id))
  }
  return ids
}

// ¿La petición viene de alguien del equipo? (token de sesión del panel)
export async function esDelEquipo(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data: u, error } = await db().auth.getUser(token)
  if (error || !u?.user) return null
  const email = String(u.user.email || '').toLowerCase()
  const { data } = await db().from('equipo').select('email').or(`user_id.eq.${u.user.id},email.eq.${email}`).limit(1)
  return data?.length ? u.user : null
}
