import { CFG, fechaValida, json, ocupadasDelDia } from './_lib/comun.js'

// GET /api/availability?estacion=PC-03&fecha=2026-10-01  →  { ocupadas: [12, 13] }
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' })
  const { estacion, fecha } = req.query
  if (!CFG.ESTACIONES.includes(estacion) || !fechaValida(fecha)) return json(res, 400, { error: 'Datos inválidos' })
  try {
    return json(res, 200, { ocupadas: await ocupadasDelDia(estacion, fecha) })
  } catch (e) {
    console.error('availability', e)
    return json(res, 500, { error: 'No pudimos consultar la disponibilidad.' })
  }
}
