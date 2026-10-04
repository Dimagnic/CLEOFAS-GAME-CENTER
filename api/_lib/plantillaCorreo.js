// Arma el correo de confirmación (sin dependencias, para poder probarlo solo).
// Los datos del negocio (dirección, teléfono, mapa) salen de src/data/negocio.js.
import { NEGOCIO, MAPA_LINK, formato12, whatsappUrl } from '../../src/data/negocio.js'

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// r = fila de reservaciones, est = { id, tipo, specs } de la estación
export function armarCorreo(r, est, sitio) {
  const [h, m] = String(r.hora).split(':').map(Number)
  const ini = h * 60 + (m || 0)
  const fin = ini + r.duracion_h * 60
  const fecha = mayus(
    new Date(`${r.fecha}T12:00:00-06:00`).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
    }),
  )
  const horario = `${formato12(ini)} a ${formato12(fin)}`
  const duracion = `${r.duracion_h} ${r.duracion_h === 1 ? 'hora' : 'horas'}`
  const equipo = est ? `${est.id} · ${est.tipo}${est.specs ? ` (${est.specs})` : ''}` : r.estacion
  const monto = `$${Number(r.monto).toLocaleString('es-MX')} MXN`
  const nombre = String(r.cliente).trim().split(' ')[0]
  const wa = whatsappUrl(`Hola, tengo una duda sobre mi reservación ${r.folio}`)

  const filas = [
    ['Equipo', equipo],
    ['Fecha', fecha],
    ['Horario', horario],
    ['Duración', duracion],
    ['Total pagado', monto],
  ]

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef0f6;font-family:Arial,Helvetica,sans-serif;color:#15161c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;">
  <tr><td style="background:#0a0a0c;padding:22px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px;"><img src="${esc(sitio)}/logo.jpg" width="40" height="40" alt="" style="display:block;border-radius:8px;"></td>
      <td style="color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:1px;">CLEOFAS <span style="color:#9aa3c7;font-weight:normal;">GAME CENTER</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:#4c6fff;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:30px 28px 8px;">
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;">¡Tu reservación está confirmada, ${esc(nombre)}!</h1>
    <p style="margin:0;font-size:15px;line-height:1.55;color:#4a4f63;">Recibimos tu pago y tu lugar ya está apartado. Presenta este folio al llegar.</p>
  </td></tr>
  <tr><td style="padding:18px 28px;">
    <div style="background:#f3f5ff;border:1px solid #d6dcff;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:12px;letter-spacing:1.5px;color:#5b63a0;text-transform:uppercase;">Folio</div>
      <div style="font-size:30px;font-weight:bold;letter-spacing:3px;font-family:'Courier New',monospace;color:#2a3cc8;">${esc(r.folio)}</div>
    </div>
  </td></tr>
  <tr><td style="padding:0 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
      ${filas
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e8f0;color:#6a6f84;width:36%;">${k}</td><td style="padding:10px 0;border-bottom:1px solid #e6e8f0;font-weight:bold;">${esc(v)}</td></tr>`,
        )
        .join('')}
    </table>
  </td></tr>
  <tr><td style="padding:22px 28px 6px;">
    <div style="font-size:14px;font-weight:bold;margin-bottom:6px;">Dónde estamos</div>
    <div style="font-size:14px;line-height:1.5;color:#4a4f63;">${esc(NEGOCIO.direccion)}</div>
    <div style="margin-top:12px;">
      <a href="${esc(MAPA_LINK)}" style="display:inline-block;background:#4c6fff;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 20px;border-radius:8px;">Cómo llegar</a>
    </div>
  </td></tr>
  <tr><td style="padding:22px 28px 10px;">
    <div style="font-size:14px;font-weight:bold;margin-bottom:6px;">Antes de venir</div>
    <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#4a4f63;">
      <li>Llega unos minutos antes y muestra tu folio.</li>
      <li>¿Necesitas cambiar o cancelar? Escríbenos por <a href="${esc(wa)}" style="color:#2a3cc8;">WhatsApp</a> o al ${esc(NEGOCIO.telefono)}.</li>
    </ul>
  </td></tr>
  <tr><td style="padding:22px 28px 28px;">
    <div style="border-top:1px solid #e6e8f0;padding-top:16px;font-size:12px;line-height:1.6;color:#8a8fa3;">
      ${esc(NEGOCIO.horarioLineas.join(' · '))}<br>
      <a href="${esc(NEGOCIO.redes.instagram)}" style="color:#8a8fa3;">Instagram</a> ·
      <a href="${esc(NEGOCIO.redes.tiktok)}" style="color:#8a8fa3;">TikTok</a> ·
      <a href="${esc(NEGOCIO.redes.facebook)}" style="color:#8a8fa3;">Facebook</a><br>
      <a href="${esc(sitio)}/privacidad" style="color:#8a8fa3;">Aviso de privacidad</a> ·
      <a href="${esc(sitio)}/politica-de-cancelacion" style="color:#8a8fa3;">Política de cancelación y reembolso</a><br>
      Este correo confirma tu reservación en ${esc(NEGOCIO.nombre)}.
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  const texto = [
    `¡Tu reservación está confirmada, ${nombre}!`,
    '',
    `Folio: ${r.folio}`,
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Dónde estamos: ${NEGOCIO.direccion}`,
    `Cómo llegar: ${MAPA_LINK}`,
    '',
    'Llega unos minutos antes y muestra tu folio.',
    `¿Cambios o cancelaciones? WhatsApp ${NEGOCIO.telefono}: ${wa}`,
    `Política de cancelación y reembolso: ${sitio}/politica-de-cancelacion`,
  ].join('\n')

  return { asunto: `Reservación confirmada · Folio ${r.folio}`, html, texto }
}
