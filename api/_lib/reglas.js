// Reglas del negocio compartidas por las funciones del servidor (sin dependencias).
// Si cambias horarios, tarifas o estaciones, actualiza también src/lib/reservas.js
// (lo que ve el cliente en pantalla). El servidor es quien manda: recalcula el precio y el horario.

export const CFG = {
  ESTACIONES: ['PC-01', 'PC-02', 'PC-03', 'PC-04', 'PC-05', 'XB-01', 'XB-02', 'XB-03', 'XB-04', 'XB-05', 'XB-06'],
  MAX_HORAS: 5,
  HOLD_MIN: 31,            // minutos que se aparta el horario mientras el cliente paga
  DIAS_ADELANTE: 60,
  TZ_OFFSET: '-06:00',     // Puebla / CDMX (sin horario de verano)
  PASO_MIN: 5,             // los horarios se ofrecen en múltiplos de 5 minutos
  MARGEN_MIN: 0,           // descanso entre un cliente y el siguiente (0 = sin margen; 5 = cinco minutos)
  SESION_VENCIDA_MIN: 10,  // si una sesión del piso ya pasó su hora y nadie la cierra, se asume que sigue 10 min más
}

// Horario por día de la semana (0 = domingo … 6 = sábado), en minutos desde medianoche: [abre, cierra].
// Debe coincidir con src/data/negocio.js.
const SEMANA = {
  0: [570, 1140], 1: [570, 1140], 2: [570, 1140], 3: [570, 1140], 4: [570, 1140], // 9:30 – 19:00
  5: [570, 1230], 6: [570, 1230],                                                  // 9:30 – 20:30
}
export function horarioDe(fecha) {
  const [abre, cierra] = SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()]
  return { abre, cierra }
}
export function formato12(min) {
  const h = Math.floor(min / 60), m = min % 60
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'a.m.' : 'p.m.'}`
}

// Tarifas: 1 h = $35, paquete 3 h = $90, paquete 5 h = $140. Se toma la combinación más barata.
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

export function fechaValida(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false
  const d = new Date(`${f}T12:00:00Z`)
  return !isNaN(d) && d.toISOString().slice(0, 10) === f
}

export const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Fecha y hora de Puebla de un instante: { fecha: '2026-10-01', min: minutos desde medianoche }
export function ahoraMX(ms = Date.now()) {
  const local = new Date(ms - 6 * 3600000) // UTC-6 fijo
  return { fecha: local.toISOString().slice(0, 10), min: local.getUTCHours() * 60 + local.getUTCMinutes() }
}

// Instante real de una fecha y un minuto del día (hora de Puebla).
export function inicioMX(fecha, minutos) {
  return new Date(`${fecha}T${hhmm(minutos)}:00${CFG.TZ_OFFSET}`)
}

export const redondearArriba = (min) => Math.ceil(min / CFG.PASO_MIN) * CFG.PASO_MIN

// bloques = [{ ini, fin }] en minutos del día. ¿Se empalma [ini, ini+durMin) con alguno (con margen)?
export function chocaConBloques(ini, durMin, bloques) {
  return bloques.some((b) => ini < b.fin + CFG.MARGEN_MIN && ini + durMin > b.ini - CFG.MARGEN_MIN)
}

// Devuelve el primer error de validación (texto para el cliente) o null si todo está bien.
export function validarReserva(b, ahora = Date.now()) {
  const cliente = String(b.cliente ?? '').trim()
  const email = String(b.email ?? '').trim()
  const telefono = String(b.telefono ?? '').replace(/\D/g, '')
  if (cliente.length < 2 || cliente.length > 80) return 'Escribe tu nombre.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return 'Escribe un correo válido para enviarte el comprobante.'
  if (telefono && (telefono.length < 8 || telefono.length > 15)) return 'El teléfono no parece válido.'
  if (!CFG.ESTACIONES.includes(b.estacion)) return 'Esa estación no existe.'
  if (!fechaValida(b.fecha)) return 'Elige una fecha válida.'
  const ini = Number(b.inicioMin)
  const dur = Number(b.duracion)
  if (!Number.isInteger(dur) || dur < 1 || dur > CFG.MAX_HORAS) return `Puedes reservar de 1 a ${CFG.MAX_HORAS} horas.`
  const { abre, cierra } = horarioDe(b.fecha)
  if (!Number.isInteger(ini) || ini % CFG.PASO_MIN !== 0 || ini < abre || ini + dur * 60 > cierra) {
    return `Ese día nuestro horario es de ${formato12(abre)} a ${formato12(cierra)}`
  }
  const inicio = inicioMX(b.fecha, ini)
  if (inicio.getTime() <= ahora) return 'Ese horario ya pasó. Elige otro.'
  if (inicio.getTime() > ahora + CFG.DIAS_ADELANTE * 86400000) return `Solo puedes reservar con ${CFG.DIAS_ADELANTE} días de anticipación.`
  return null
}
