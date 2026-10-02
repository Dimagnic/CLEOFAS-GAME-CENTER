// Lo que el cliente ve en pantalla. El servidor (api/_lib/reglas.js) valida y recalcula todo;
// estas constantes deben coincidir con las de allá.
export const HORA_ABRE = 11
export const HORA_CIERRA = 23
export const MAX_HORAS = 5
export const PASO_MIN = 5
export const MARGEN_MIN = 0 // descanso entre un cliente y el siguiente (0 = sin margen)

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

export const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Fecha y hora actuales en Puebla, sin importar la zona del visitante.
export function ahoraMX() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const g = (t) => partes.find((p) => p.type === t).value
  return { fecha: `${g('year')}-${g('month')}-${g('day')}`, min: Number(g('hour')) * 60 + Number(g('minute')) }
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

// bloques = [{ ini, fin }] en minutos del día (reservas y sesiones en curso).
export function chocaConBloques(ini, durMin, bloques) {
  return bloques.some((b) => ini < b.fin + MARGEN_MIN && ini + durMin > b.ini - MARGEN_MIN)
}

// Horas de inicio (en minutos del día) que se pueden reservar para una duración:
// las horas en punto libres, y además el minuto exacto en que se libera la estación (ej. 12:10).
export function iniciosPosibles({ bloques, duracion, fecha, hoy }) {
  const durMin = duracion * 60
  const candidatos = new Set()
  for (let h = HORA_ABRE; h < HORA_CIERRA; h++) candidatos.add(h * 60)
  for (const b of bloques) candidatos.add(Math.ceil((b.fin + MARGEN_MIN) / PASO_MIN) * PASO_MIN)
  return [...candidatos]
    .filter((m) =>
      m >= HORA_ABRE * 60 &&
      m + durMin <= HORA_CIERRA * 60 &&
      !(fecha === hoy.fecha && m <= hoy.min) &&
      !chocaConBloques(m, durMin, bloques))
    .sort((a, b) => a - b)
}
