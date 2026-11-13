// Correos del Club Cleofas: cupones nuevos y publicaciones (promociones, eventos…).
import { NEGOCIO } from '../../src/data/negocio.js'

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const APLICA = { horas: 'en horas y paquetes', snacks: 'en snacks y bebidas', todo: 'en lo que quieras' }
const valor = (c) => (c.tipo === 'porcentaje' ? `${Number(c.valor)}%` : `$${Number(c.valor)}`)
const fecha = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })

function marco({ titulo, intro, cuerpo, boton, enlace, sitio }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#03050A;font-family:Arial,Helvetica,sans-serif;color:#F4F7FF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#03050A;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0A1220;border:1px solid #E10B0B;">
<tr><td style="padding:26px 30px 6px;">
  <p style="margin:0;font-size:12px;letter-spacing:4px;color:#FF2A2A;font-family:'Courier New',monospace;">CLUB CLEOFAS</p>
  <h1 style="margin:10px 0 0;font-size:25px;line-height:1.2;text-transform:uppercase;color:#F4F7FF;">${esc(titulo)}</h1>
</td></tr>
<tr><td style="padding:10px 30px 4px;font-size:15px;line-height:1.6;color:#9FB0CC;">${intro}</td></tr>
${cuerpo}
<tr><td style="padding:18px 30px 8px;">
  <a href="${esc(enlace)}" style="display:inline-block;background:#E10B0B;color:#ffffff;text-decoration:none;font-weight:bold;letter-spacing:2px;text-transform:uppercase;padding:14px 26px;font-size:14px;">${esc(boton)}</a>
</td></tr>
<tr><td style="padding:14px 30px 26px;font-size:12px;line-height:1.6;color:#62738F;">
  Recibes este correo porque eres socio del Club Cleofas. Puedes dejar de recibir avisos en
  <a href="${esc(sitio)}/cuenta" style="color:#2EC4FF;">tu cuenta → Mis datos</a>.
</td></tr>
</table>
<p style="margin:14px 0 0;font-size:12px;color:#62738F;">${esc(NEGOCIO.nombre)} · ${esc(NEGOCIO.direccion)}</p>
</td></tr></table>
</body></html>`
}

// Uno o varios cupones nuevos para un socio
export function correoCupones(socio, cupones, sitio) {
  const nombre = String(socio.nombre || '').trim().split(' ')[0] || 'jugador'
  const ascenso = cupones.find((c) => c.origen === 'ascenso')
  const cumple = cupones.find((c) => c.origen === 'cumpleanos')
  const titulo = cumple ? `¡Feliz cumpleaños, ${nombre}!` : ascenso ? ascenso.titulo : cupones.length > 1 ? `Tienes ${cupones.length} cupones nuevos` : 'Tienes un cupón nuevo'
  const tarjetas = cupones.map((c) => `
<tr><td style="padding:8px 30px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed #FF2A2A;background:#101C32;">
  <tr>
    <td width="96" align="center" style="padding:14px 6px;border-right:2px dashed #FF2A2A;">
      <div style="font-size:26px;font-weight:bold;color:#FF2A2A;">${esc(valor(c))}</div>
      <div style="font-size:10px;letter-spacing:2px;color:#62738F;text-transform:uppercase;">${esc(c.aplica === 'todo' ? 'todo' : c.aplica)}</div>
    </td>
    <td style="padding:12px 16px;">
      <div style="font-size:15px;font-weight:bold;color:#F4F7FF;text-transform:uppercase;">${esc(c.titulo)}</div>
      <div style="font-size:13px;color:#9FB0CC;margin-top:3px;">${esc(c.descripcion || `${valor(c)} ${APLICA[c.aplica] ?? ''}`)}</div>
      <div style="font-size:13px;color:#2EC4FF;font-family:'Courier New',monospace;letter-spacing:3px;margin-top:6px;">${esc(c.codigo)}</div>
      <div style="font-size:11px;color:#62738F;margin-top:3px;">${c.vence_at ? `Válido hasta el ${esc(fecha(c.vence_at))}` : 'Sin vencimiento'}</div>
    </td>
  </tr></table>
</td></tr>`).join('')

  const html = marco({
    titulo,
    intro: `Hola ${esc(nombre)}, ${cumple ? 'el Club Cleofas te regala:' : ascenso ? '¡felicidades por tu nuevo rango! Te ganaste:' : 'esto ya está en tu cuenta:'}`,
    cuerpo: tarjetas + `<tr><td style="padding:10px 30px 0;font-size:13px;color:#9FB0CC;">Úsalo al reservar en línea con tu sesión iniciada o muestra tu QR de socio en mostrador.</td></tr>`,
    boton: 'Ver mis cupones',
    enlace: `${sitio}/cuenta`,
    sitio,
  })
  const texto = `${titulo}\n\n` + cupones.map((c) => `• ${c.titulo}: ${valor(c)} ${APLICA[c.aplica] ?? ''} · código ${c.codigo}${c.vence_at ? ` · vence ${fecha(c.vence_at)}` : ''}`).join('\n') +
    `\n\nÚsalo al reservar en línea o muestra tu QR en mostrador.\n${sitio}/cuenta`
  return { asunto: `🎮 ${titulo}`, html, texto }
}

// Publicación (promoción, evento, noticia o comunicado)
export function correoPublicacion(p, sitio) {
  const etiqueta = { promocion: 'Promoción', evento: 'Evento', noticia: 'Noticia', comunicado: 'Comunicado' }[p.tipo] ?? 'Novedad'
  const cuando = p.fecha_evento
    ? new Date(p.fecha_evento).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })
    : ''
  const cuerpo = `
${p.imagen_url ? `<tr><td style="padding:10px 30px 0;"><img src="${esc(p.imagen_url)}" alt="" width="500" style="width:100%;max-width:500px;height:auto;display:block;border:0;"></td></tr>` : ''}
${cuando ? `<tr><td style="padding:12px 30px 0;font-size:14px;color:#B46BFF;font-weight:bold;">${esc(cuando)}${p.lugar ? ` · ${esc(p.lugar)}` : ''}</td></tr>` : ''}
<tr><td style="padding:12px 30px 0;font-size:15px;line-height:1.6;color:#C9D3E6;white-space:pre-line;">${esc(p.cuerpo)}</td></tr>`
  const html = marco({
    titulo: p.titulo,
    intro: `<span style="display:inline-block;background:#FF2A2A;color:#03050A;font-weight:bold;font-size:11px;letter-spacing:2px;padding:3px 8px;text-transform:uppercase;">${etiqueta}</span>`,
    cuerpo,
    boton: p.enlace ? (p.enlace_texto || 'Más información') : 'Ver en mi cuenta',
    enlace: p.enlace || `${sitio}/cuenta`,
    sitio,
  })
  const texto = `${etiqueta}: ${p.titulo}\n${cuando ? `${cuando}${p.lugar ? ` · ${p.lugar}` : ''}\n` : ''}\n${p.cuerpo}\n\n${p.enlace || `${sitio}/cuenta`}`
  return { asunto: `${etiqueta === 'Evento' ? '🏆' : '🔥'} ${p.titulo}`, html, texto }
}
