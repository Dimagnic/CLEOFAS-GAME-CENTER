// Datos de contacto del negocio: se usan en Contacto, pie de página y botones flotantes.
// Para cambiar la dirección, el teléfono o las redes, edita solo este archivo.
export const NEGOCIO = {
  nombre: 'Cleofas Game Center',
  telefono: '+52 56 4625 3958',   // como se muestra en pantalla
  telefonoLink: '+525646253958',  // para tel:
  whatsapp: '525646253958',       // para wa.me (código de país + número, sin + ni espacios)
  direccion: 'Av 2 Ote 811, Centro histórico de Puebla, 72000 Heroica Puebla de Zaragoza, Pue., México',
  horario: 'Todos los días, 09:00 a 22:00',
  horarioCorto: '09:00–22:00',
  redes: {
    tiktok: 'https://www.tiktok.com/@cleofascte',
    instagram: 'https://www.instagram.com/cleofasgame',
    facebook: 'https://www.facebook.com/cleofasgamezone',
  },
  desarrolladoPor: { nombre: 'Cero+', url: 'https://codefy-b3kf.vercel.app/' },
}

// Mapa de Google (sin llave de API) y enlace para abrir la ruta en la app de mapas.
const consulta = encodeURIComponent(NEGOCIO.direccion)
export const MAPA_EMBED = `https://maps.google.com/maps?q=${consulta}&z=17&output=embed`
export const MAPA_LINK = `https://www.google.com/maps/search/?api=1&query=${consulta}`

export const whatsappUrl = (mensaje = 'Hola, quiero información sobre Cleofas Game Center') =>
  `https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(mensaje)}`
