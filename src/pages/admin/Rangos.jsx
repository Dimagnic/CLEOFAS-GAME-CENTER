import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { cargarRangos } from '../../lib/socios'

const NUEVO = { nombre: '', min_puntos: '', desc_horas: 0, desc_snacks: 0, color: '#2EC4FF', beneficios: [] }

export default function Rangos() {
  const [rangos, setRangos] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function cargar() {
    try { setRangos(await cargarRangos()); setError('') } catch (e) { setError(e.message) }
  }
  useEffect(() => { if (supabaseReady) cargar() }, [])

  async function guardar(r, form) {
    setError(''); setMsg('')
    const f = new FormData(form)
    const datos = {
      nombre: String(f.get('nombre')).trim(),
      min_puntos: Math.max(0, Math.trunc(Number(f.get('min_puntos')))),
      desc_horas: Math.min(50, Math.max(0, Math.trunc(Number(f.get('desc_horas'))))),
      desc_snacks: Math.min(50, Math.max(0, Math.trunc(Number(f.get('desc_snacks'))))),
      color: String(f.get('color')),
      beneficios: String(f.get('beneficios')).split('\n').map((b) => b.trim()).filter(Boolean),
    }
    if (datos.nombre.length < 2) return setError('El rango necesita nombre.')
    if (Number.isNaN(datos.min_puntos)) return setError('Puntos mínimos inválidos.')
    const esPrimero = r.id && rangos[0]?.id === r.id
    if (esPrimero && datos.min_puntos !== 0) return setError('El primer rango debe empezar en 0 puntos (es el de todos los socios nuevos).')
    const { error } = r.id
      ? await supabase.from('rangos').update(datos).eq('id', r.id)
      : await supabase.from('rangos').insert(datos)
    if (error) return setError(/duplicate|unique/i.test(error.message) ? 'Ya existe un rango con ese nombre o con esos puntos mínimos.' : error.message)
    setMsg(`Rango "${datos.nombre}" guardado. Los socios se reacomodaron solos.`)
    if (!r.id) form.reset()
    cargar()
  }

  async function borrar(r) {
    if (rangos[0]?.id === r.id) return setError('No puedes borrar el rango inicial.')
    if (!window.confirm(`¿Borrar el rango "${r.nombre}"? Sus socios pasan al rango que les toque por puntos.`)) return
    const { error } = await supabase.from('rangos').delete().eq('id', r.id)
    if (error) return setError(error.message)
    setMsg('Rango borrado.'); cargar()
  }

  if (!supabaseReady) return <div><header className="admin-page__head"><h1>Rangos</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>

  return (
    <div>
      <header className="admin-page__head">
        <h1>Rangos y beneficios</h1>
        <p>Cada socio gana 1 punto por cada $1. Al llegar a los puntos mínimos sube de rango solo y su descuento se aplica en mostrador y en reservas en línea.</p>
      </header>

      {error && <p className="admin-note admin-note--error">{error}</p>}
      {msg && <p className="admin-note admin-note--ok">{msg}</p>}
      {!rangos && !error && <p className="admin-note">Cargando…</p>}

      <div className="rangos-lista">
        {(rangos ?? []).map((r, i) => <TarjetaRango key={r.id} r={r} primero={i === 0} onGuardar={guardar} onBorrar={borrar} />)}
        {rangos && <TarjetaRango r={NUEVO} nuevo onGuardar={guardar} />}
      </div>
    </div>
  )
}

function TarjetaRango({ r, primero, nuevo, onGuardar, onBorrar }) {
  const [color, setColor] = useState(r.color)
  return (
    <form className={`rango-card ${nuevo ? 'rango-card--nuevo' : ''}`} style={{ '--rango': color }}
      onSubmit={(e) => { e.preventDefault(); onGuardar(r, e.target) }}>
      <div className="rango-card__head">
        <input type="color" name="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color del rango" />
        <input name="nombre" defaultValue={r.nombre} placeholder={nuevo ? 'Nombre del nuevo rango' : ''} required className="rango-card__nombre" />
      </div>
      <div className="rango-card__nums">
        <label>Desde (puntos)<input name="min_puntos" type="number" min="0" step="1" defaultValue={r.min_puntos} required readOnly={primero} title={primero ? 'El rango inicial siempre empieza en 0' : undefined} /></label>
        <label>Desc. horas %<input name="desc_horas" type="number" min="0" max="50" step="1" defaultValue={r.desc_horas} /></label>
        <label>Desc. snacks %<input name="desc_snacks" type="number" min="0" max="50" step="1" defaultValue={r.desc_snacks} /></label>
      </div>
      <label className="rango-card__benef">
        Beneficios (uno por línea, los ve el socio)
        <textarea name="beneficios" rows={4} defaultValue={(r.beneficios ?? []).join('\n')} />
      </label>
      <div className="rango-card__acciones">
        <button className="btn btn-primary btn-sm">{nuevo ? 'Agregar rango' : 'Guardar'}</button>
        {!nuevo && !primero && <button type="button" className="admin-link admin-link--peligro" onClick={() => onBorrar(r)}>Borrar</button>}
      </div>
    </form>
  )
}
