// Datos de contacto del negocio: se usan en Contacto, pie de página y botones flotantes.
// Para cambiar la dirección, el teléfono o las redes, edita solo este archivo.
export const NEGOCIO = {
  nombre: 'Cleofas Game Center',
  telefono: '+52 56 4625 3958',   // como se muestra en pantalla
  telefonoLink: '+525646253958',  // para tel:
  whatsapp: '525646253958',       // para wa.me (código de país + número, sin + ni espacios)
  direccion: 'Av. Reforma 000, Centro, Puebla, Pue.', // ← PENDIENTE: reemplazar por la dirección real
  horario: 'Todos los días, 09:00 a 22:00',
  horarioCorto: '09:00–22:00',
  redes: {
    tiktok: 'https://www.tiktok.com/@cleofascte',
    instagram: 'https://www.instagram.com/cleofasgame',
    facebook: 'https://www.facebook.com/cleofasgamezone',
  },
  desarrolladoPor: { nombre: 'Cero+', url: 'https://codefy-b3kf.vercel.app/' },
}

export const whatsappUrl = (mensaje = 'Hola, quiero información sobre Cleofas Game Center') =>
  `https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(mensaje)}`
