import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { cargarRangos, estadoCupon, textoCupon, fechaDia, pesos, apiEquipo } from '../../lib/socios'
import SocioPicker from './SocioPicker'

// Plantillas rápidas: un clic llena el formulario
const PLANTILLAS = [
  { titulo: '1 hora gratis', descripcion: 'Una hora de juego en la estación que elijas.', tipo: 'monto', valor: 35, aplica: 'horas', dias: 30 },
  { titulo: 'Snack gratis', descripcion: 'Un snack o bebida de hasta $25.', tipo: 'monto', valor: 25, aplica: 'snacks', dias: 30 },
  { titulo: '20% en snacks', descripcion: '', tipo: 'porcentaje', valor: 20, aplica: 'snacks', dias: 15 },
  { titulo: '$30 en paquete', descripcion: 'Válido en paquetes de 3 o 5 horas.', tipo: 'monto', valor: 30, aplica: 'horas', dias: 30 },
  { titulo: 'Regalo de cumpleaños', descripcion: '¡Feliz cumpleaños de parte del Club Cleofas!', tipo: 'monto', valor: 70, aplica: 'todo', dias: 15 },
]
const VACIO = { titulo: '', descripcion: '', tipo: 'monto', valor: '', aplica: 'horas', dias: 30 }
const ESTADOS = { disponible: 'Disponible', usado: 'Usado', vencido: 'Vencido', anulado: 'Anulado' }

export default function Cupones() {
  const { session } = useAuth()
  const [rangos, setRangos] = useState([])
  const [cupones, setCupones] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [f, setF] = useState(VACIO)
  const [destino, setDestino] = useState('socio')
  const [socio, setSocio] = useState(null)
  const [rangoId, setRangoId] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)
  const [avisar, setAvisar] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')

  async function cargar() {
    const { data, error } = await supabase.from('cupones').select('*, socios(nombre, email)').order('created_at', { ascending: false }).limit(500)
    if (error) setError(`${error.message}. ¿Ya ejecutaste supabase/migration-fase2.sql?`)
    else setCupones(data)
  }
  useEffect(() => {
    if (!supabaseReady) return
    cargar()
    cargarRangos().then((r) => { setRangos(r); setRangoId(String(r[0]?.id ?? '')) }).catch(() => {})
  }, [])

  const cambia = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function destinatarios() {
    if (destino === 'socio') return socio ? [socio.user_id] : []
    let consulta = supabase.from('socios').select('user_id, puntos, rango_id')
    const { data, error } = await consulta.limit(5000)
    if (error) throw error
    if (destino === 'todos') return data.map((s) => s.user_id)
    const minimo = rangos.find((r) => String(r.id) === rangoId)?.min_puntos ?? 0
    const nivel = Object.fromEntries(rangos.map((r) => [r.id, r.min_puntos]))
    return data.filter((s) => (nivel[s.rango_id] ?? -1) >= minimo).map((s) => s.user_id)
  }

  async function emitir(e) {
    e.preventDefault()
    setError(''); setMsg('')
    const valor = Number(f.valor)
    if (f.titulo.trim().length < 3) return setError('Ponle un título al cupón (ej. "1 hora gratis").')
    if (!(valor > 0)) return setError('El valor debe ser mayor a 0.')
    if (f.tipo === 'porcentaje' && valor > 100) return setError('El porcentaje no puede pasar de 100.')
    setEmitiendo(true)
    try {
      const ids = await destinatarios()
      if (!ids.length) throw new Error(destino === 'socio' ? 'Elige al socio que recibirá el cupón.' : 'No hay socios en ese grupo.')
      const resumen = destino === 'socio' ? (socio.nombre || socio.email) : `${ids.length} socios`
      if (ids.length > 1 && !window.confirm(`Se emitirá "${f.titulo}" a ${resumen}. ¿Continuar?`)) { setEmitiendo(false); return }
      const lote = `${new Date().toISOString().slice(0, 16)} · ${f.titulo.trim()}`
      const dias = Number(f.dias)
      const vence = dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null
      const filas = ids.map((id) => ({
        socio_id: id, titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, tipo: f.tipo, valor, aplica: f.aplica,
        vence_at: vence, origen: ids.length > 1 ? 'masivo' : 'manual', lote, creado_por: session?.user?.email ?? 'panel',
      }))
      for (let i = 0; i < filas.length; i += 500) {
        const { error } = await supabase.from('cupones').insert(filas.slice(i, i + 500))
        if (error) throw error
      }
      let aviso = ''
      if (avisar) {
        try {
          const r = await apiEquipo('/api/notificar', { cupones: true })
          aviso = ` Se enviaron ${r.correos} correo${r.correos === 1 ? '' : 's'} de aviso.`
        } catch (e2) {
          aviso = ` (No se pudo avisar por correo ahora: ${e2.message} Se intentará en la tarea diaria.)`
        }
      }
      setMsg(`Cupón "${f.titulo.trim()}" emitido a ${resumen}. Ya lo ven en su cuenta.${aviso}`)
      setSocio(null)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEmitiendo(false)
    }
  }

  async function anular(c) {
    if (!window.confirm(`¿Anular el cupón ${c.codigo} de ${c.socios?.nombre || c.socios?.email}?`)) return
    const { error } = await supabase.from('cupones').update({ estado: 'anulado' }).eq('id', c.id).eq('estado', 'disponible')
    if (error) setError(error.message)
    else cargar()
  }

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (cupones ?? []).filter((c) =>
      (!filtro || estadoCupon(c) === filtro) &&
      (!t || `${c.codigo} ${c.titulo} ${c.socios?.nombre ?? ''} ${c.socios?.email ?? ''}`.toLowerCase().includes(t)))
  }, [cupones, q, filtro])

  const stats = useMemo(() => {
    const todos = cupones ?? []
    const usados = todos.filter((c) => c.estado === 'usado')
    return {
      disponibles: todos.filter((c) => estadoCupon(c) === 'disponible').length,
      usados: usados.length,
      tasa: todos.length ? Math.round((usados.length / todos.length) * 100) : 0,
      descontado: usados.reduce((s, c) => s + Number(c.descuento_aplicado || 0), 0),
    }
  }, [cupones])

  if (!supabaseReady) return <div><header className="admin-page__head"><h1>Cupones</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>

  return (
    <div>
      <header className="admin-page__head">
        <h1>Cupones</h1>
        <p>Regala horas, snacks y descuentos a un socio, a un rango o a todo el club. Se canjean en Estaciones y Tienda al elegir al socio.</p>
      </header>

      <div className="admin-cards">
        <div className="admin-card"><p className="admin-card__label">Disponibles</p><p className="admin-card__value">{stats.disponibles}</p></div>
        <div className="admin-card"><p className="admin-card__label">Canjeados</p><p className="admin-card__value">{stats.usados}</p></div>
        <div className="admin-card"><p className="admin-card__label">Tasa de canje</p><p className="admin-card__value">{stats.tasa}%</p></div>
        <div className="admin-card"><p className="admin-card__label">Descontado en total</p><p className="admin-card__value">{pesos(stats.descontado)}</p></div>
      </div>

      {error && <p className="admin-note admin-note--error">{error}</p>}
      {msg && <p className="admin-note admin-note--ok">{msg}</p>}

      <section className="admin-section emitir">
        <h2>Emitir cupón</h2>
        <div className="emitir__plantillas">
          {PLANTILLAS.map((p) => (
            <button key={p.titulo} type="button" className={f.titulo === p.titulo ? 'is-on' : ''} onClick={() => setF(p)}>
              <b>{p.tipo === 'porcentaje' ? `${p.valor}%` : `$${p.valor}`}</b>{p.titulo}
            </button>
          ))}
        </div>
        <form className="emitir__form" onSubmit={emitir}>
          <label>Título<input value={f.titulo} onChange={cambia('titulo')} placeholder="1 hora gratis" maxLength={60} /></label>
          <label>Descripción (opcional)<input value={f.descripcion} onChange={cambia('descripcion')} placeholder="Lo que verá el socio" maxLength={140} /></label>
          <label>Tipo
            <select value={f.tipo} onChange={cambia('tipo')}>
              <option value="monto">Monto en pesos</option>
              <option value="porcentaje">Porcentaje</option>
            </select>
          </label>
          <label>{f.tipo === 'porcentaje' ? 'Porcentaje' : 'Hasta $'}<input type="number" min="1" step="1" value={f.valor} onChange={cambia('valor')} /></label>
          <label>Aplica en
            <select value={f.aplica} onChange={cambia('aplica')}>
              <option value="horas">Horas y paquetes</option>
              <option value="snacks">Snacks y bebidas</option>
              <option value="todo">Todo</option>
            </select>
          </label>
          <label>Vigencia (días)<input type="number" min="0" step="1" value={f.dias} onChange={cambia('dias')} title="0 = sin vencimiento" /></label>

          <div className="emitir__destino">
            <span>Para</span>
            <div className="novedades__filtros">
              {[['socio', 'Un socio'], ['rango', 'Un rango o superior'], ['todos', 'Todos los socios']].map(([k, t]) => (
                <button type="button" key={k} className={destino === k ? 'is-active' : ''} onClick={() => setDestino(k)}>{t}</button>
              ))}
            </div>
            {destino === 'socio' && <SocioPicker value={socio} onChange={setSocio} />}
            {destino === 'rango' && (
              <select value={rangoId} onChange={(e) => setRangoId(e.target.value)}>
                {rangos.map((r) => <option key={r.id} value={r.id}>{r.nombre} y superiores</option>)}
              </select>
            )}
          </div>
          <label className="emitir__avisar">
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
            Avisar por correo ahora (si no, se avisa en la tarea diaria de la mañana)
          </label>
          <button className="btn btn-primary" disabled={emitiendo}>{emitiendo ? 'Emitiendo…' : 'Emitir cupón'}</button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Cupones emitidos</h2>
        <div className="admin-form-inline">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código C-XXXXXX, título o socio" />
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        {!cupones && !error ? <p className="admin-note">Cargando…</p> : lista.length === 0 ? <p className="admin-note">No hay cupones con ese filtro.</p> : (
          <table className="admin-table">
            <thead><tr><th>Código</th><th>Cupón</th><th>Socio</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {lista.map((c) => {
                const est = estadoCupon(c)
                return (
                  <tr key={c.id}>
                    <td className="mono">{c.codigo}</td>
                    <td><strong>{c.titulo}</strong><br /><span className="mono">{textoCupon(c)}</span></td>
                    <td>{c.socios?.nombre || '—'}<br /><span className="mono">{c.socios?.email}</span></td>
                    <td className="mono">{c.vence_at ? fechaDia(c.vence_at) : 'Sin vencimiento'}</td>
                    <td>
                      <span className={`estado-pill estado-cupon--${est}`}>{ESTADOS[est]}</span>
                      {est === 'usado' && <><br /><span className="mono">{c.usado_en} · −{pesos(c.descuento_aplicado)}</span></>}
                    </td>
                    <td>{est === 'disponible' && <button className="admin-link admin-link--peligro" onClick={() => anular(c)}>Anular</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
