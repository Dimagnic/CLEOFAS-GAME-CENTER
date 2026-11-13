import { db, json, sitioURL } from './_lib/comun.js'
import { avisarCuponesPendientes, esDelEquipo } from './_lib/club.js'

// Tarea diaria del Club (la llama Vercel Cron, ver vercel.json):
//   1) cupones de cumpleaños y de reactivación (reglas del panel → Automatización)
//   2) correo a los socios con cupones nuevos (bienvenida, ascenso, cumpleaños, los emitidos en el panel…)
// También se puede correr a mano desde el panel con el botón "Ejecutar ahora".
export default async function handler(req, res) {
  const secreto = process.env.CRON_SECRET
  const deVercel = secreto && req.headers.authorization === `Bearer ${secreto}`
  const equipo = deVercel ? null : await esDelEquipo(req).catch(() => null)
  if (!deVercel && !equipo) return json(res, 401, { error: 'No autorizado' })

  try {
    const { data: reglas, error } = await db().rpc('procesar_automatizaciones', { p_origen: deVercel ? 'cron' : `panel: ${equipo.email}` })
    if (error) throw error
    const correos = await avisarCuponesPendientes(sitioURL(req))
    return json(res, 200, { ok: true, reglas, correos })
  } catch (e) {
    console.error('cron', e)
    return json(res, 500, { error: e.message || 'Falló la automatización' })
  }
}
