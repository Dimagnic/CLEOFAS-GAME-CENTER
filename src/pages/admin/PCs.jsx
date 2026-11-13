import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useStations } from '../../lib/StationsStore'

// Código que se pega en el programa "Cleofas Agente" de cada PC.
// Lleva la dirección del proyecto, la llave pública (la misma que usa la página web)
// y el token secreto de esa PC. Solo se muestra una vez: si se pierde, se vincula de nuevo.
function armarCodigo(token, estacion) {
  const json = JSON.stringify({ u: import.meta.env.VITE_SUPABASE_URL, k: import.meta.env.VITE_SUPABASE_ANON_KEY, t: token, e: estacion })
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `CLEOFAS-${b64}`
}

const hace = (iso) => {
  if (!iso) return 'nunca'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function PCs() {
  const { estaciones } = useStations()
  const [disp, setDisp] = useState([])
  const [msg, setMsg] = useState('')
  const [codigo, setCodigo] = useState(null) // { estacion, codigo }
  const [mensaje, setMensaje] = useState(null) // { estacion, texto }
  const [, setTic] = useState(0)

  const pcs = estaciones.filter((e) => e.id.startsWith('PC'))

  async function cargar() {
    if (!supabaseReady) return
    const { data, error } = await supabase.from('dispositivos')
      .select('id, estacion_id, nombre, version, ultimo_contacto, created_at').eq('activo', true)
    if (error) setMsg(`Error: ${error.message}`)
    else setDisp(data)
  }

  useEffect(() => {
    cargar()
    const t = setInterval(() => { cargar(); setTic((n) => n + 1) }, 10000)
    return () => clearInterval(t)
  }, [])

  async function vincular(est) {
    const previo = disp.find((d) => d.estacion_id === est.id)
    if (previo && !window.confirm(`${est.id} ya tiene una PC vinculada. Si generas un código nuevo, la anterior deja de funcionar. ¿Continuar?`)) return
    const { data, error } = await supabase.rpc('vincular_dispositivo', { p_estacion: est.id, p_nombre: est.id })
    if (error) return setMsg(`Error: ${error.message}`)
    setCodigo({ estacion: est.id, codigo: armarCodigo(data, est.id), copiado: false })
    cargar()
  }

  async function desvincular(d) {
    if (!window.confirm(`¿Desvincular ${d.estacion_id}? El programa de esa PC mostrará la pantalla de vinculación.`)) return
    const { error } = await supabase.from('dispositivos').update({ activo: false }).eq('id', d.id)
    setMsg(error ? `Error: ${error.message}` : `${d.estacion_id} desvinculada.`)
    cargar()
  }

  async function enviarMensaje(e) {
    e.preventDefault()
    const texto = mensaje.texto.trim()
    if (!texto) return
    const { error } = await supabase.rpc('mensaje_dispositivo', { p_estacion: mensaje.estacion, p_mensaje: texto })
    setMsg(error ? `Error: ${error.message}` : `Mensaje enviado a ${mensaje.estacion}.`)
    setMensaje(null)
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(codigo.codigo); setCodigo({ ...codigo, copiado: true }) } catch { /* el texto está seleccionable */ }
  }

  return (
    <div>
      <header className="admin-page__head">
        <h1>PCs · Control de tiempo</h1>
        <p>Cada PC tiene el programa <b>Cleofas Agente</b>: muestra el tiempo restante al cliente y bloquea la pantalla al terminar. El tiempo se agrega desde <b>Estaciones → + Agregar tiempo</b>.</p>
      </header>
      {msg && <p className={`admin-note ${msg.startsWith('Error') ? 'admin-note--error' : 'admin-note--ok'}`}>{msg}</p>}

      <table className="admin-table pcs">
        <thead><tr><th>Estación</th><th>Programa</th><th>Último contacto</th><th>Estado ahora</th><th /></tr></thead>
        <tbody>
          {pcs.map((est) => {
            const d = disp.find((x) => x.estacion_id === est.id)
            const enLinea = d?.ultimo_contacto && Date.now() - new Date(d.ultimo_contacto).getTime() < 20000
            return (
              <tr key={est.id}>
                <td><strong>{est.id}</strong></td>
                <td>{!d ? <span className="pcs__sin">Sin vincular</span> : (
                  <span className="pcs__estado"><i className={`pc-led ${enLinea ? 'is-on' : ''}`} />{enLinea ? 'En línea' : 'Sin respuesta'}{d.version ? ` · v${d.version}` : ''}</span>
                )}</td>
                <td>{d ? hace(d.ultimo_contacto) : '—'}</td>
                <td>{est.estado === 'sesion' ? `En uso · ${est.restanteMin ?? 0} min` : est.estado === 'mantenimiento' ? 'Mantenimiento' : 'Libre (bloqueada)'}</td>
                <td className="pcs__acciones">
                  {d && <button className="admin-link" onClick={() => setMensaje({ estacion: est.id, texto: '' })}>Mensaje</button>}
                  <button className="admin-link" onClick={() => vincular(est)}>{d ? 'Nuevo código' : 'Vincular'}</button>
                  {d && <button className="admin-link admin-link--peligro" onClick={() => desvincular(d)}>Desvincular</button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <details className="hw__ayuda pcs__ayuda">
        <summary>¿Cómo instalo el programa en una PC?</summary>
        <ol>
          <li>Instala <code>Cleofas Agente Setup.exe</code> en la PC (con la cuenta de administrador de Windows).</li>
          <li>Aquí, presiona <b>Vincular</b> en esa estación y copia el código.</li>
          <li>En la PC aparece la pantalla de vinculación: pega el código y elige un PIN de 4 a 8 dígitos para el personal.</li>
          <li>Listo: la PC queda bloqueada hasta que inicies una sesión en Estaciones. Para entrar como personal: <code>Ctrl + Alt + Shift + C</code> y el PIN.</li>
        </ol>
      </details>

      {codigo && (
        <div className="admin-modal__backdrop" onClick={() => setCodigo(null)}>
          <div className="admin-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>Código para {codigo.estacion}</h3>
            <p className="socio-picker__nota">Pégalo en el programa de la PC. Solo se muestra esta vez y sirve para una sola PC; trátalo como una contraseña.</p>
            <textarea className="pcs__codigo" readOnly value={codigo.codigo} onFocus={(e) => e.target.select()} rows={5} />
            <div className="admin-modal__actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setCodigo(null)}>Cerrar</button>
              <button className="btn btn-primary btn-sm" onClick={copiar}>{codigo.copiado ? '✔ Copiado' : 'Copiar código'}</button>
            </div>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="admin-modal__backdrop" onClick={() => setMensaje(null)}>
          <form className="admin-modal" onClick={(ev) => ev.stopPropagation()} onSubmit={enviarMensaje}>
            <h3>Mensaje a la pantalla de {mensaje.estacion}</h3>
            <input autoFocus maxLength={140} value={mensaje.texto} placeholder="Ej. Tu pedido está listo en mostrador" onChange={(e) => setMensaje({ ...mensaje, texto: e.target.value })} />
            <p className="socio-picker__nota">Aparece unos segundos en la esquina de la pantalla del cliente.</p>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMensaje(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={!mensaje.texto.trim()}>Enviar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
