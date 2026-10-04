// Datos de contacto del negocio: se usan en Contacto, pie de página y botones flotantes.
// Para cambiar la dirección, el teléfono o las redes, edita solo este archivo.
export const NEGOCIO = {
  nombre: 'Cleofas Game Center',
  telefono: '+52 56 4625 3958',   // como se muestra en pantalla
  telefonoLink: '+525646253958',  // para tel:
  whatsapp: '525646253958',       // para wa.me (código de país + número, sin + ni espacios)
  direccion: 'Av 2 Ote 811, Centro histórico de Puebla, 72000 Heroica Puebla de Zaragoza, Pue., México',
  horarioLineas: ['Domingo a jueves: 9:30 a.m. – 7 p.m.', 'Viernes y sábado: 9:30 a.m. – 8:30 p.m.'],
  redes: {
    tiktok: 'https://www.tiktok.com/@cleofascte',
    instagram: 'https://www.instagram.com/cleofasgame',
    facebook: 'https://www.facebook.com/cleofasgamezone',
  },
  desarrolladoPor: { nombre: 'Cero+', url: 'https://codefy-b3kf.vercel.app/' },
}

// Datos para el Aviso de privacidad y la Política de cancelación (páginas /privacidad y /politica-de-cancelacion).
// PENDIENTE: completa lo que esté vacío con los datos reales del titular y revisa los textos con un abogado.
export const LEGAL = {
  responsable: '',          // nombre completo o razón social de quien es responsable de los datos
  correoPrivacidad: '',     // correo para ejercer derechos ARCO (acceso, rectificación, cancelación, oposición)
  actualizado: '4 de octubre de 2026',
  version: '2026-10-04',    // se guarda junto al pago para saber qué versión aceptó el cliente
  revisadoPorAbogado: false, // al terminar la revisión legal, cámbialo a true y desaparece el aviso de "borrador"
  horasSinCostoCancelacion: 24, // con al menos estas horas de anticipación, cancelación sin costo
}

// Horario por día de la semana (0 = domingo … 6 = sábado), en minutos desde medianoche: [abre, cierra].
// Debe coincidir con api/_lib/reglas.js (ahí se valida cada reserva).
const SEMANA = {
  0: [570, 1140], 1: [570, 1140], 2: [570, 1140], 3: [570, 1140], 4: [570, 1140], // 9:30 – 19:00
  5: [570, 1230], 6: [570, 1230],                                                  // 9:30 – 20:30
}
export function horarioDe(fechaISO) {
  const [abre, cierra] = SEMANA[new Date(`${fechaISO}T12:00:00Z`).getUTCDay()]
  return { abre, cierra }
}
// 570 → "9:30 a.m.", 1140 → "7 p.m."
export function formato12(min) {
  const h = Math.floor(min / 60), m = min % 60
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'a.m.' : 'p.m.'}`
}
export function horarioHoyTexto() {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  const { abre, cierra } = horarioDe(hoy)
  return `${formato12(abre)} – ${formato12(cierra)}`
}

// Mapa de Google (sin llave de API) y enlace para abrir la ruta en la app de mapas.
const consulta = encodeURIComponent(NEGOCIO.direccion)
export const MAPA_EMBED = `https://maps.google.com/maps?q=${consulta}&z=17&output=embed`
export const MAPA_LINK = `https://www.google.com/maps/search/?api=1&query=${consulta}`

export const whatsappUrl = (mensaje = 'Hola, quiero información sobre Cleofas Game Center') =>
  `https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(mensaje)}`
