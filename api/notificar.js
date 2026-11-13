import { db, json, sitioURL } from './_lib/comun.js'
import { enviarLote, avisarCuponesPendientes, esDelEquipo } from './_lib/club.js'
import { correoPublicacion } from './_lib/plantillaClub.js'

// POST /api/notificar  (solo equipo)
//   { publicacionId }  → envía la publicación por correo a los socios que pueden verla y aceptan correos
//   { cupones: true }  → envía ya los avisos de cupones nuevos (sin esperar a la tarea diaria)
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' })
  const usuario = await esDelEquipo(req).catch(() => null)
  if (!usuario) return json(res, 401, { error: 'Solo el equipo puede enviar avisos' })
  const sitio = sitioURL(req)

  try {
    if (req.body?.cupones) return json(res, 200, await avisarCuponesPendientes(sitio))

    const id = String(req.body?.publicacionId || '')
    const { data: p, error } = await db().from('publicaciones').select('*, rangos(min_puntos)').eq('id', id).maybeSingle()
    if (error) throw error
    if (!p) return json(res, 404, { error: 'Publicación no encontrada' })
    if (!p.publicado) return json(res, 400, { error: 'Publica la publicación antes de enviarla por correo' })

    const { data: socios, error: e2 } = await db().from('socios').select('email, nombre, rangos(min_puntos)').eq('acepta_correos', true).limit(5000)
    if (e2) throw e2
    const minimo = p.rangos?.min_puntos ?? -1
    const destinatarios = socios.filter((s) => s.email && (s.rangos?.min_puntos ?? -1) >= minimo)
    const correo = correoPublicacion(p, sitio)
    const enviados = await enviarLote(destinatarios.map((s) => ({ to: s.email, ...correo })))
    await db().from('publicaciones').update({ notificado_at: new Date().toISOString(), notificados: enviados }).eq('id', p.id)
    return json(res, 200, { enviados, destinatarios: destinatarios.length })
  } catch (e) {
    console.error('notificar', e)
    return json(res, 500, { error: e.message || 'No se pudieron enviar los correos' })
  }
}
