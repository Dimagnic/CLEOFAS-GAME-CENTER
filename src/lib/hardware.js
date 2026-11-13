// Integración con hardware del mostrador, sin controladores especiales:
//  · Lector de códigos de barras / QR (USB o Bluetooth en modo teclado "HID"): escribe muy rápido y termina con Enter.
//  · Cámara (celular, tableta o webcam): lee QR y, donde el navegador lo permite, códigos de barras.
//  · Impresora térmica (58 u 80 mm): cualquier impresora instalada en el equipo, vía impresión del navegador.
import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

// ---------------------------------------------------------------------------
// Lector en modo teclado: distingue al lector (teclas a <35 ms) de una persona escribiendo.
// onCodigo(codigo) se llama al terminar la lectura (Enter o Tab). Funciona aunque el foco esté
// en un campo de texto: si fue el lector, se cancela la escritura en ese campo.
// ---------------------------------------------------------------------------
export function useLectorCodigos(onCodigo, { activo = true, minLargo = 4, intervaloMs = 35 } = {}) {
  const cb = useRef(onCodigo)
  cb.current = onCodigo
  useEffect(() => {
    if (!activo) return undefined
    let buffer = ''
    let ultimo = 0
    let rapido = 0
    function onKey(e) {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const ahora = performance.now()
      const delta = ahora - ultimo
      ultimo = ahora
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buffer.length >= minLargo && rapido >= buffer.length - 1) {
          e.preventDefault()
          const codigo = buffer
          // Borra lo que el lector alcanzó a escribir en un campo
          const el = document.activeElement
          if (el && 'value' in el && typeof el.value === 'string' && el.value.endsWith(codigo)) {
            const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set
            set?.call(el, el.value.slice(0, -codigo.length))
            el.dispatchEvent(new Event('input', { bubbles: true }))
          }
          cb.current(codigo.trim())
        }
        buffer = ''; rapido = 0
        return
      }
      if (e.key.length !== 1) return
      if (delta > 300) { buffer = ''; rapido = 0 }      // pausa larga: empieza una lectura nueva
      else if (delta < intervaloMs) rapido++
      buffer += e.key
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [activo, minLargo, intervaloMs])
}

// ---------------------------------------------------------------------------
// Cámara: BarcodeDetector (Android, Mac, ChromeOS: QR y códigos de barras) o jsQR (cualquier navegador: QR)
// ---------------------------------------------------------------------------
export const camaraDisponible = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

export async function iniciarCamara(video, onCodigo, { onError } = {}) {
  let stream
  let timer
  let detenido = false
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
  } catch (e) {
    onError?.(e.name === 'NotAllowedError'
      ? 'El navegador no tiene permiso de usar la cámara. Actívalo en el candado de la barra de direcciones.'
      : e.name === 'NotFoundError' ? 'No se encontró ninguna cámara.' : `No se pudo abrir la cámara (${e.message}).`)
    return () => {}
  }
  video.srcObject = stream
  video.setAttribute('playsinline', '')
  video.muted = true
  await video.play().catch(() => {})

  let detector = null
  if ('BarcodeDetector' in window) {
    try {
      const formatos = await window.BarcodeDetector.getSupportedFormats()
      if (formatos.length) detector = new window.BarcodeDetector({ formats: formatos })
    } catch { detector = null }
  }
  const jsQR = detector ? null : (await import('jsqr')).default
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  async function leer() {
    if (detenido || !video.videoWidth) return
    try {
      if (detector) {
        const [c] = await detector.detect(video)
        if (c?.rawValue) return onCodigo(c.rawValue.trim())
      } else {
        const w = Math.min(video.videoWidth, 800)
        const h = Math.round((video.videoHeight / video.videoWidth) * w)
        canvas.width = w; canvas.height = h
        ctx.drawImage(video, 0, 0, w, h)
        const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
        if (r?.data) return onCodigo(r.data.trim())
      }
    } catch { /* cuadro no listo */ }
  }
  timer = setInterval(leer, 250)
  return () => { detenido = true; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()) }
}

export const motorCamara = () => ('BarcodeDetector' in window ? 'BarcodeDetector (QR y códigos de barras)' : 'jsQR (solo códigos QR)')

// ---------------------------------------------------------------------------
// Impresión de tickets en impresora térmica (58 u 80 mm)
// ---------------------------------------------------------------------------
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const dinero = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const METODOS = { efectivo: 'Efectivo', terminal: 'Tarjeta (terminal)', qr: 'Transferencia / QR', en_linea: 'Pago en línea' }

// Imprime HTML en un iframe oculto con el tamaño de papel del ticket. Devuelve una promesa.
export function imprimirHTML(cuerpo, { ancho = 80 } = {}) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)
    const mm = Number(ancho) === 58 ? 58 : 80
    const util = mm === 58 ? 48 : 72 // área imprimible típica
    iframe.contentDocument.open()
    iframe.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
      @page { size: ${mm}mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      body { width: ${util}mm; margin: 0 auto; padding: 3mm 0 6mm; font: ${mm === 58 ? 11 : 12}px/1.35 "Courier New", ui-monospace, monospace; }
      .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; } .g { font-size: 1.35em; }
      .sep { border-top: 1px dashed #000; margin: 2mm 0; }
      table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: .3mm 0; }
      .qr { display: block; margin: 2mm auto 0; width: ${mm === 58 ? 30 : 38}mm; height: auto; image-rendering: pixelated; }
    </style></head><body>${cuerpo}</body></html>`)
    iframe.contentDocument.close()
    const imgs = [...iframe.contentDocument.images]
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = ok; i.onerror = ok }))))
      .then(() => {
        const w = iframe.contentWindow
        const terminar = () => { setTimeout(() => iframe.remove(), 500); resolve() }
        w.addEventListener('afterprint', terminar, { once: true })
        w.focus()
        w.print()
        setTimeout(terminar, 60000) // por si el navegador no avisa "afterprint"
      })
  })
}

// Ticket de venta o comprobante de pedido. venta = fila de ventas + items (venta_items)
export async function htmlTicket(venta, items, cfg = {}) {
  const qr = await QRCode.toDataURL(venta.folio, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
  const fecha = new Date(venta.pagada_at || venta.created_at).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  })
  const pagada = venta.estado === 'pagada'
  const filas = items.map((i) => `<tr><td colspan="2">${esc(i.nombre)}</td></tr>
    <tr><td>${i.cantidad} x ${dinero(i.precio_unit)}</td><td class="r">${dinero(i.precio_unit * i.cantidad)}</td></tr>`).join('')
  return `
    <div class="c b g">${esc(cfg.encabezado || 'CLEOFAS GAME CENTER')}</div>
    ${cfg.direccion ? `<div class="c">${esc(cfg.direccion)}</div>` : ''}
    ${cfg.telefono ? `<div class="c">Tel. ${esc(cfg.telefono)}</div>` : ''}
    <div class="sep"></div>
    <div class="c b">${pagada ? 'TICKET DE VENTA' : venta.estado === 'cancelada' ? 'VENTA CANCELADA' : 'PEDIDO PENDIENTE DE PAGO'}</div>
    <table><tr><td>Folio</td><td class="r b">${esc(venta.folio)}</td></tr>
      <tr><td>Fecha</td><td class="r">${esc(fecha)}</td></tr>
      ${venta.cliente ? `<tr><td>Cliente</td><td class="r">${esc(venta.cliente)}</td></tr>` : ''}
      ${venta.cobrado_por ? `<tr><td>Atendió</td><td class="r">${esc(String(venta.cobrado_por).split('@')[0])}</td></tr>` : ''}
    </table>
    <div class="sep"></div>
    <table>${filas}</table>
    <div class="sep"></div>
    <table>
      <tr><td>Subtotal</td><td class="r">${dinero(venta.subtotal)}</td></tr>
      ${Number(venta.descuento_socio) ? `<tr><td>Desc. socio</td><td class="r">-${dinero(venta.descuento_socio)}</td></tr>` : ''}
      ${Number(venta.descuento_cupon) ? `<tr><td>Cupón</td><td class="r">-${dinero(venta.descuento_cupon)}</td></tr>` : ''}
      <tr class="b g"><td>TOTAL</td><td class="r">${dinero(venta.total)}</td></tr>
      ${pagada ? `<tr><td>Pago</td><td class="r">${esc(METODOS[venta.metodo_pago] ?? venta.metodo_pago)}</td></tr>` : ''}
      ${venta.metodo_pago === 'efectivo' && venta.recibido != null ? `<tr><td>Recibido</td><td class="r">${dinero(venta.recibido)}</td></tr><tr><td>Cambio</td><td class="r">${dinero(venta.cambio)}</td></tr>` : ''}
      ${venta.referencia_pago ? `<tr><td>Referencia</td><td class="r">${esc(venta.referencia_pago)}</td></tr>` : ''}
    </table>
    ${venta.puntos ? `<div class="sep"></div><div class="c">Puntos ganados: <span class="b">+${venta.puntos}</span></div>` : ''}
    <div class="sep"></div>
    <img class="qr" src="${qr}" alt="">
    <div class="c">${esc(venta.folio)}</div>
    <div class="sep"></div>
    <div class="c">${esc(cfg.pie || '¡Gracias por tu visita!')}</div>
  `
}

export async function imprimirTicket(venta, items, cfg = {}) {
  return imprimirHTML(await htmlTicket(venta, items, cfg), { ancho: cfg.ancho })
}

// Página de prueba para la impresora
export function imprimirPrueba(cfg = {}) {
  const ancho = Number(cfg.ancho) === 58 ? 58 : 80
  const regla = '1234567890'.repeat(5).slice(0, ancho === 58 ? 32 : 48)
  return imprimirHTML(`
    <div class="c b g">PRUEBA DE IMPRESIÓN</div>
    <div class="c">${esc(cfg.encabezado || 'CLEOFAS GAME CENTER')}</div>
    <div class="sep"></div>
    <div>Papel configurado: ${ancho} mm</div>
    <div>Fecha: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</div>
    <div class="sep"></div>
    <div>${regla}</div>
    <div class="b">Negritas · Acentos: áéíóú ñ ¿? ¡!</div>
    <div class="r">Alineado a la derecha</div>
    <div class="sep"></div>
    <div class="c">Si este ticket se ve completo, sin cortes a los lados, la impresora está lista.</div>
  `, { ancho })
}
