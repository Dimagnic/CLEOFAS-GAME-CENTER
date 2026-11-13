import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useLectorCodigos, imprimirPrueba, camaraDisponible, motorCamara } from '../../lib/hardware'
import { NEGOCIO } from '../../data/negocio'
import EscanerCamara from './EscanerCamara'

export const TICKET_DEF = { ancho: 80, encabezado: 'CLEOFAS GAME CENTER', pie: '¡Gracias por tu visita! Vuelve pronto.', direccion: '', telefono: NEGOCIO.telefono, auto: true }

export async function cargarConfigTicket() {
  if (!supabaseReady) return TICKET_DEF
  const { data } = await supabase.from('config_negocio').select('valor').eq('clave', 'ticket').maybeSingle()
  return { ...TICKET_DEF, ...(data?.valor ?? {}) }
}

export default function Hardware() {
  const [cfg, setCfg] = useState(TICKET_DEF)
  const [msg, setMsg] = useState('')
  const [lecturas, setLecturas] = useState([])
  const [camara, setCamara] = useState(false)
  const [resCamara, setResCamara] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => { cargarConfigTicket().then(setCfg) }, [])

  // Prueba del lector: cada lectura aparece en la lista con su velocidad
  useLectorCodigos((codigo) => setLecturas((l) => [{ codigo, hora: new Date().toLocaleTimeString('es-MX') }, ...l].slice(0, 8)))

  async function guardar(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const valor = {
      ancho: Number(f.get('ancho')) === 58 ? 58 : 80,
      encabezado: String(f.get('encabezado')).trim() || TICKET_DEF.encabezado,
      direccion: String(f.get('direccion')).trim(),
      telefono: String(f.get('telefono')).trim(),
      pie: String(f.get('pie')).trim(),
      auto: Boolean(f.get('auto')),
    }
    const { error } = await supabase.from('config_negocio').upsert({ clave: 'ticket', valor, updated_at: new Date().toISOString() })
    setMsg(error ? `Error: ${error.message}` : 'Configuración del ticket guardada.')
    if (!error) setCfg(valor)
  }

  return (
    <div>
      <header className="admin-page__head">
        <h1>Hardware</h1>
        <p>Configura el ticket y prueba la impresora, el lector de códigos y la cámara en este equipo.</p>
      </header>
      {msg && <p className="admin-note admin-note--ok">{msg}</p>}

      <div className="hw">
        <section className="hw__caja">
          <h2>1 · Impresora térmica</h2>
          <form className="hw__form" onSubmit={guardar} key={JSON.stringify(cfg)}>
            <label>Ancho del papel
              <select name="ancho" defaultValue={cfg.ancho}><option value="80">80 mm</option><option value="58">58 mm</option></select>
            </label>
            <label>Encabezado<input name="encabezado" defaultValue={cfg.encabezado} maxLength={40} /></label>
            <label>Dirección (opcional)<input name="direccion" defaultValue={cfg.direccion} maxLength={80} /></label>
            <label>Teléfono<input name="telefono" defaultValue={cfg.telefono} maxLength={30} /></label>
            <label className="hw__ancho">Mensaje final<input name="pie" defaultValue={cfg.pie} maxLength={80} /></label>
            <label className="prod-editor__check hw__ancho"><input type="checkbox" name="auto" defaultChecked={cfg.auto} /> Imprimir el ticket automáticamente al cobrar</label>
            <div className="hw__acciones">
              <button className="btn btn-primary btn-sm">Guardar</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => imprimirPrueba(cfg)}>Imprimir prueba</button>
            </div>
          </form>
          <details className="hw__ayuda">
            <summary>Cómo dejarla lista (una sola vez)</summary>
            <ol>
              <li>Instala el controlador de tu impresora en Windows (Epson TM-T20, Xprinter, 3nStar, etc.) y conéctala por USB, red o Bluetooth.</li>
              <li>En Windows → Impresoras, márcala como <b>predeterminada</b> y en sus preferencias elige el papel de {cfg.ancho} mm (o "Roll paper {cfg.ancho} x 297").</li>
              <li>Da clic en <b>Imprimir prueba</b>. En la ventana de impresión elige la térmica, márgenes <b>Ninguno</b> y quita "Encabezados y pies de página".</li>
              <li><b>Sin ventana de impresión</b> (opcional): abre Chrome o Edge con el acceso directo modificado agregando <code>--kiosk-printing</code> al final del destino. Así cada ticket sale directo a la impresora predeterminada.</li>
            </ol>
          </details>
        </section>

        <section className="hw__caja">
          <h2>2 · Lector de códigos (USB / Bluetooth)</h2>
          <p className="socio-picker__nota">Escanea cualquier código de barras o QR con el lector. Funciona con lectores en modo teclado (HID), que es el modo de fábrica de casi todos.</p>
          <div className="hw__lecturas" aria-live="polite">
            {lecturas.length === 0 ? <p className="hw__espera">Esperando lectura… escanea algo ahora.</p> : lecturas.map((l, i) => (
              <div key={i} className={i === 0 ? 'is-nueva' : ''}><code>{l.codigo}</code><span>{l.hora}</span></div>
            ))}
          </div>
          {lecturas.length > 0 && <p className="admin-note admin-note--ok">✔ El lector funciona. En el POS, al escanear, el producto se agrega solo al carrito.</p>}
          <details className="hw__ayuda">
            <summary>¿No aparece nada?</summary>
            <ul>
              <li>Abre el Bloc de notas y escanea: si ahí tampoco escribe, el lector no está conectado o no está en modo teclado (revisa su manual: "USB HID Keyboard").</li>
              <li>Si escribe pero aquí no aparece, configura el lector para que agregue <b>Enter</b> (CR) al final de cada lectura.</li>
              <li>Si salen letras cambiadas, configura el idioma del lector en "Español (Latinoamérica)" o "US" igual que tu teclado.</li>
            </ul>
          </details>
        </section>

        <section className="hw__caja">
          <h2>3 · Cámara (QR de socios y pedidos)</h2>
          <p className="socio-picker__nota">{camaraDisponible() ? `Motor de lectura en este navegador: ${motorCamara()}.` : 'Este navegador no permite usar la cámara (abre el panel con https o desde un celular/tableta).'}</p>
          <button className="btn btn-primary btn-sm" disabled={!camaraDisponible()} onClick={() => { setResCamara(''); setCamara(true) }}>Probar cámara</button>
          {resCamara && <p className="admin-note admin-note--ok">✔ Leído: <code>{resCamara}</code></p>}
          <label className="hw__manual">¿Sin cámara ni lector? Escribe un folio o código:
            <input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="V-XXXXXX, S-XXXXXX o CL-XXXXX" />
          </label>
          <p className="socio-picker__nota">El POS acepta lo mismo: folios de pedido (V-…), códigos de socio (S-…) y folios de reserva (CL-…).</p>
        </section>
      </div>
      {camara && <EscanerCamara titulo="Prueba de cámara" onCerrar={() => setCamara(false)} onCodigo={(c) => { setResCamara(c); setCamara(false) }} />}
    </div>
  )
}
