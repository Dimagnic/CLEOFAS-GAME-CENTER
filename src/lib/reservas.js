// Lo que el cliente ve en pantalla. El servidor (api/_lib/reglas.js) valida y recalcula todo.
export const HORA_ABRE = 11
export const HORA_CIERRA = 23
export const MAX_HORAS = 5

export function precioPorHoras(h) {
  const best = [0]
  for (let i = 1; i <= h; i++) {
    best[i] = Math.min(
      best[i - 1] + 35,
      i >= 3 ? best[i - 3] + 90 : Infinity,
      i >= 5 ? best[i - 5] + 140 : Infinity,
    )
  }
  return best[h]
}

// Fecha y hora actuales en Puebla, sin importar la zona del visitante.
export function ahoraMX() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const g = (t) => partes.find((p) => p.type === t).value
  return { fecha: `${g('year')}-${g('month')}-${g('day')}`, hora: Number(g('hour')) }
}

export function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export async function api(ruta, opciones) {
  const r = await fetch(ruta, opciones)
  let datos = null
  try { datos = await r.json() } catch { /* respuesta sin JSON */ }
  if (!r.ok) throw new Error(datos?.error || 'No pudimos conectar con el servidor.')
  return datos
}
