// Reglas del negocio compartidas por las funciones del servidor (sin dependencias).
// Si cambias horarios, tarifas o estaciones, actualiza también src/lib/reservas.js
// (lo que ve el cliente en pantalla). El servidor es quien manda: recalcula el precio.

export const CFG = {
  ESTACIONES: ['PC-01', 'PC-02', 'PC-03', 'PC-04', 'PC-05', 'PC-06', 'PC-07', 'PC-08', 'PS-01', 'PS-02'],
  HORA_ABRE: 11,     // 11:00
  HORA_CIERRA: 23,   // 23:00
  MAX_HORAS: 5,
  HOLD_MIN: 31,      // minutos que se aparta el horario mientras el cliente paga
  DIAS_ADELANTE: 60,
  TZ_OFFSET: '-06:00', // Puebla / CDMX (sin horario de verano)
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

export function inicioMX(fecha, hora) {
  return new Date(`${fecha}T${String(hora).padStart(2, '0')}:00:00${CFG.TZ_OFFSET}`)
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
  const hora = Number(b.hora)
  const dur = Number(b.duracion)
  if (!Number.isInteger(dur) || dur < 1 || dur > CFG.MAX_HORAS) return `Puedes reservar de 1 a ${CFG.MAX_HORAS} horas.`
  if (!Number.isInteger(hora) || hora < CFG.HORA_ABRE || hora + dur > CFG.HORA_CIERRA) {
    return `Nuestro horario es de ${CFG.HORA_ABRE}:00 a ${CFG.HORA_CIERRA}:00.`
  }
  const inicio = inicioMX(b.fecha, hora)
  if (inicio.getTime() <= ahora) return 'Ese horario ya pasó. Elige otro.'
  if (inicio.getTime() > ahora + CFG.DIAS_ADELANTE * 86400000) return `Solo puedes reservar con ${CFG.DIAS_ADELANTE} días de anticipación.`
  return null
}
