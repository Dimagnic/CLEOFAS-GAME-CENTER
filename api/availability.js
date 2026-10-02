import { CFG, ahoraMX, bloquesDelDia, fechaValida, json } from './_lib/comun.js'

// GET /api/availability?estacion=PC-03&fecha=2026-10-01
//  →  { bloques: [{ ini: 0, fin: 730 }, ...], hoy: { fecha, min } }   (minutos desde medianoche)
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' })
  const { estacion, fecha } = req.query
  if (!CFG.ESTACIONES.includes(estacion) || !fechaValida(fecha)) return json(res, 400, { error: 'Datos inválidos' })
  try {
    const ahora = Date.now()
    return json(res, 200, { bloques: await bloquesDelDia(estacion, fecha, ahora), hoy: ahoraMX(ahora) })
  } catch (e) {
    console.error('availability', e)
    return json(res, 500, { error: 'No pudimos consultar la disponibilidad.' })
  }
}
