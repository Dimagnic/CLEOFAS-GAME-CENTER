import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { cargarRangos, DIAS_SEMANA, apiEquipo, fechaCorta } from '../../lib/socios'

const DESCRIPCION = {
  bienvenida: 'Se entrega al crear su cuenta.',
  cumpleanos: 'Se entrega el día de su cumpleaños (si lo capturó), una vez al año.',
  reactivacion: 'Para socios que no han venido en cierto tiempo. Máximo uno por periodo.',
  ascenso: 'Se entrega al subir a este rango, una sola vez en la vida del socio.',
}

export default function Automatizacion() {
  const [reglas, setReglas] = useState(null)
  const [rangos, setRangos] = useState([])
  const [campanas, setCampanas] = useState([])
  const [log, setLog] = useState([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [corriendo, setCorriendo] = useState(false)

  async function cargar() {
    const [r, c, l] = await Promise.all([
      supabase.from('reglas').select('*').order('clave'),
      supabase.from('campanas').select('*').order('created_at', { ascending: false }),
      supabase.from('automatizaciones_log').select('*').order('ran_at', { ascending: false }).limit(8),
    ])
    if (r.error) return setError(`${r.error.message}. ¿Ya ejecutaste supabase/migration-fase3.sql?`)
    setReglas(r.data); setCampanas(c.data ?? []); setLog(l.data ?? [])
  }
  useEffect(() => {
    if (!supabaseReady) return
    cargar()
    cargarRangos().then(setRangos).catch(() => {})
  }, [])

  async function guardarRegla(clave, form) {
    setError(''); setMsg('')
    const f = new FormData(form)
    const datos = {
      activo: Boolean(f.get('activo')),
      titulo: String(f.get('titulo')).trim(),
      descripcion: String(f.get('descripcion') || '').trim() || null,
      tipo: f.get('tipo'),
      valor: Number(f.get('valor')),
      aplica: f.get('aplica'),
      dias: Math.max(0, Math.trunc(Number(f.get('dias')))),
      updated_at: new Date().toISOString(),
      ...(f.has('parametro') ? { parametro: Math.max(1, Math.trunc(Number(f.get('parametro')))) } : {}),
    }
    if (datos.titulo.length < 3) return setError('El cupón necesita título.')
    if (!(datos.valor > 0) || (datos.tipo === 'porcentaje' && datos.valor > 100)) return setError('Revisa el valor del cupón.')
    const { error } = await supabase.from('reglas').update(datos).eq('clave', clave)
    if (error) return setError(error.message)
    setMsg('Regla guardada.'); cargar()
  }

  async function ejecutar() {
    setCorriendo(true); setError(''); setMsg('')
    try {
      const r = await apiEquipo('/api/cron')
      setMsg(`Listo: ${r.reglas.cumpleanos} cupones de cumpleaños, ${r.reglas.reactivacion} de reactivación y ${r.correos.correos} correos enviados.`)
      cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setCorriendo(false)
    }
  }

  if (!supabaseReady) return <div><header className="admin-page__head"><h1>Automatización</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>

  const porClave = Object.fromEntries((reglas ?? []).map((r) => [r.clave, r]))
  const ascensos = rangos.filter((r) => porClave[`ascenso:${r.id}`])

  return (
    <div>
      <header className="admin-page__head admin-page__head--accion">
        <div>
          <h1>Automatización</h1>
          <p>Premios que se entregan solos y campañas de puntos. Cada mañana a las 9:00 se revisan cumpleaños y socios inactivos, y se avisa por correo de los cupones nuevos.</p>
        </div>
        <button className="btn btn-ghost" onClick={ejecutar} disabled={corriendo}>{corriendo ? 'Ejecutando…' : 'Ejecutar ahora'}</button>
      </header>

      {error && <p className="admin-note admin-note--error">{error}</p>}
      {msg && <p className="admin-note admin-note--ok">{msg}</p>}
      {!reglas && !error && <p className="admin-note">Cargando…</p>}

      {reglas && (
        <>
          <section className="admin-section">
            <h2>Cupones automáticos</h2>
            <div className="reglas">
              {['bienvenida', 'cumpleanos', 'reactivacion'].filter((k) => porClave[k]).map((k) => (
                <Regla key={k} r={porClave[k]} nombre={{ bienvenida: 'Bienvenida', cumpleanos: 'Cumpleaños', reactivacion: 'Reactivación' }[k]}
                  descripcion={DESCRIPCION[k]} onGuardar={guardarRegla} parametro={k === 'reactivacion'} />
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Premio al subir de rango</h2>
            <div className="reglas">
              {ascensos.map((r) => (
                <Regla key={r.id} r={porClave[`ascenso:${r.id}`]} nombre={`Llegar a ${r.nombre}`} color={r.color}
                  descripcion={DESCRIPCION.ascenso} onGuardar={guardarRegla} />
              ))}
              {rangos.length > 1 && ascensos.length < rangos.length - 1 && (
                <p className="admin-note">Hay rangos nuevos sin premio configurado. Vuelve a ejecutar <code>supabase/migration-fase3.sql</code> para crearlos.</p>
              )}
            </div>
          </section>

          <Campanas campanas={campanas} onCambio={cargar} onError={setError} />

          <section className="admin-section">
            <h2>Últimas ejecuciones</h2>
            {log.length === 0 ? <p className="admin-note">Aún no se ha ejecutado. Se corre sola cada mañana una vez publicada en Vercel, o con "Ejecutar ahora".</p> : (
              <table className="admin-table">
                <thead><tr><th>Cuándo</th><th>Origen</th><th>Cumpleaños</th><th>Reactivación</th></tr></thead>
                <tbody>
                  {log.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{fechaCorta(l.ran_at)}</td>
                      <td>{l.origen}</td>
                      <td>{l.resultado?.cumpleanos ?? 0}</td>
                      <td>{l.resultado?.reactivacion ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Regla({ r, nombre, descripcion, color, parametro, onGuardar }) {
  const [activo, setActivo] = useState(r.activo)
  const [tipo, setTipo] = useState(r.tipo)
  return (
    <form className={`regla ${activo ? 'is-on' : ''}`} style={color ? { '--rango': color } : undefined} onSubmit={(e) => { e.preventDefault(); onGuardar(r.clave, e.target) }}>
      <div className="regla__head">
        <div>
          <h3>{nombre}</h3>
          <p>{descripcion}</p>
        </div>
        <label className="interruptor" title={activo ? 'Activa' : 'Apagada'}>
          <input type="checkbox" name="activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span />
        </label>
      </div>
      <div className="regla__campos">
        <label className="regla__ancho">Título del cupón<input name="titulo" defaultValue={r.titulo} maxLength={60} /></label>
        <label className="regla__ancho">Mensaje<input name="descripcion" defaultValue={r.descripcion ?? ''} maxLength={140} /></label>
        <label>Tipo
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="monto">Monto $</option>
            <option value="porcentaje">Porcentaje</option>
          </select>
        </label>
        <label>{tipo === 'porcentaje' ? '%' : 'Hasta $'}<input name="valor" type="number" min="1" step="1" defaultValue={r.valor} /></label>
        <label>Aplica en
          <select name="aplica" defaultValue={r.aplica}>
            <option value="horas">Horas</option>
            <option value="snacks">Snacks</option>
            <option value="todo">Todo</option>
          </select>
        </label>
        <label>Vigencia (días)<input name="dias" type="number" min="0" step="1" defaultValue={r.dias} /></label>
        {parametro && <label className="regla__ancho">Si no viene en (días)<input name="parametro" type="number" min="7" step="1" defaultValue={r.parametro ?? 45} /></label>}
      </div>
      <button className="btn btn-primary btn-sm">Guardar</button>
    </form>
  )
}

function Campanas({ campanas, onCambio, onError }) {
  const [dias, setDias] = useState([])

  async function crear(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const datos = {
      nombre: String(f.get('nombre')).trim(),
      multiplicador: Number(f.get('multiplicador')),
      aplica: f.get('aplica'),
      desde: f.get('desde') || null,
      hasta: f.get('hasta') || null,
      dias_semana: dias.length ? dias : null,
    }
    if (datos.nombre.length < 3) return onError('Ponle nombre a la campaña (ej. "Martes de puntos dobles").')
    if (datos.desde && datos.hasta && datos.hasta < datos.desde) return onError('La fecha final es antes que la inicial.')
    const { error } = await supabase.from('campanas').insert(datos)
    if (error) return onError(error.message)
    e.target.reset(); setDias([]); onCambio()
  }
  async function cambiar(c, cambios) {
    const { error } = await supabase.from('campanas').update(cambios).eq('id', c.id)
    if (error) onError(error.message)
    onCambio()
  }
  async function borrar(c) {
    if (!window.confirm(`¿Borrar la campaña "${c.nombre}"?`)) return
    const { error } = await supabase.from('campanas').delete().eq('id', c.id)
    if (error) onError(error.message)
    onCambio()
  }
  const toggleDia = (d) => setDias((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort()))

  return (
    <section className="admin-section">
      <h2>Campañas de puntos</h2>
      <p className="admin-note">Multiplican los puntos que se ganan (por ejemplo, puntos dobles los martes). Los socios ven el aviso en su cuenta el día que aplica.</p>
      <form className="campana-form" onSubmit={crear}>
        <label>Nombre<input name="nombre" placeholder="Martes de puntos dobles" maxLength={60} /></label>
        <label>Multiplicador
          <select name="multiplicador" defaultValue="2">
            <option value="1.5">x1.5</option><option value="2">x2</option><option value="3">x3</option>
          </select>
        </label>
        <label>Aplica en
          <select name="aplica" defaultValue="todo">
            <option value="todo">Todo</option><option value="horas">Horas</option><option value="snacks">Snacks</option>
          </select>
        </label>
        <label>Desde (opcional)<input name="desde" type="date" /></label>
        <label>Hasta (opcional)<input name="hasta" type="date" /></label>
        <div className="campana-form__dias">
          <span>Días (vacío = todos)</span>
          <div>{DIAS_SEMANA.map((d, i) => <button type="button" key={d} className={dias.includes(i) ? 'is-on' : ''} onClick={() => toggleDia(i)}>{d}</button>)}</div>
        </div>
        <button className="btn btn-primary btn-sm">Crear campaña</button>
      </form>

      {campanas.length > 0 && (
        <table className="admin-table">
          <thead><tr><th>Campaña</th><th>Puntos</th><th>Cuándo</th><th>Activa</th><th></th></tr></thead>
          <tbody>
            {campanas.map((c) => (
              <tr key={c.id} className={c.activo ? '' : 'is-apagado'}>
                <td><strong>{c.nombre}</strong></td>
                <td className="txt-pos">x{Number(c.multiplicador)} en {c.aplica}</td>
                <td className="mono">
                  {c.desde || c.hasta ? `${c.desde ?? '…'} → ${c.hasta ?? '…'}` : 'Siempre'}
                  {c.dias_semana?.length ? ` · ${c.dias_semana.map((d) => DIAS_SEMANA[d]).join(', ')}` : ''}
                </td>
                <td><input type="checkbox" checked={c.activo} onChange={(e) => cambiar(c, { activo: e.target.checked })} /></td>
                <td><button className="admin-link admin-link--peligro" onClick={() => borrar(c)}>Borrar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
