import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { cargarRangos, TIPOS_PUB, fechaDia, apiEquipo } from '../../lib/socios'
import { TarjetaNovedad } from '../cuenta/Club'
import '../cuenta/cuenta.css'

// <input type="datetime-local"> ↔ ISO, siempre en hora de Puebla (UTC-6)
const aLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - 6 * 3600000).toISOString().slice(0, 16) : '')
const aISO = (v) => (v ? new Date(`${v}:00-06:00`).toISOString() : null)

const NUEVA = {
  tipo: 'promocion', titulo: '', cuerpo: '', imagen_url: '', fecha_evento: null, lugar: '', enlace: '', enlace_texto: '',
  rango_min_id: null, destacado: false, publicado: true, visible_desde: null, visible_hasta: null,
}

function estadoPub(p) {
  const ahora = Date.now()
  if (!p.publicado) return ['borrador', 'Borrador']
  if (p.visible_desde && new Date(p.visible_desde).getTime() > ahora) return ['programada', `Programada · ${fechaDia(p.visible_desde)}`]
  if (p.visible_hasta && new Date(p.visible_hasta).getTime() <= ahora) return ['caducada', 'Caducada']
  return ['visible', 'Visible']
}

export default function Publicaciones() {
  const [lista, setLista] = useState(null)
  const [rangos, setRangos] = useState([])
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(null)
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(null)

  async function enviarCorreo(p) {
    const extra = p.notificado_at ? `\n\nOJO: ya se envió el ${fechaDia(p.notificado_at)} a ${p.notificados ?? 0} socios.` : ''
    if (!window.confirm(`¿Enviar "${p.titulo}" por correo a los socios que pueden verla y aceptan correos?${extra}`)) return
    setEnviando(p.id); setError(''); setMsg('')
    try {
      const r = await apiEquipo('/api/notificar', { publicacionId: p.id })
      setMsg(`Enviada a ${r.enviados} de ${r.destinatarios} socios.${r.enviados < r.destinatarios ? ' Algunos no salieron: revisa el límite diario de tu plan de Resend.' : ''}`)
      cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(null)
    }
  }

  async function cargar() {
    const { data, error } = await supabase.from('publicaciones').select('*, rangos(nombre, color)').order('created_at', { ascending: false })
    if (error) setError(`${error.message}. ¿Ya ejecutaste supabase/migration-fase2.sql?`)
    else { setError(''); setLista(data) }
  }
  useEffect(() => {
    if (!supabaseReady) return
    cargar()
    cargarRangos().then(setRangos).catch(() => {})
  }, [])

  async function cambiar(p, cambios) {
    const { error } = await supabase.from('publicaciones').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', p.id)
    if (error) setError(error.message)
    cargar()
  }
  async function borrar(p) {
    if (!window.confirm(`¿Borrar "${p.titulo}"? Los socios dejarán de verla.`)) return
    const { error } = await supabase.from('publicaciones').delete().eq('id', p.id)
    if (error) setError(error.message)
    cargar()
  }

  if (!supabaseReady) return <div><header className="admin-page__head"><h1>Publicaciones</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>

  return (
    <div>
      <header className="admin-page__head admin-page__head--accion">
        <div>
          <h1>Publicaciones</h1>
          <p>Promociones, eventos, torneos, noticias y comunicados que ven los socios en su cuenta.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditando(NUEVA)}>Nueva publicación</button>
      </header>

      {error && <p className="admin-note admin-note--error">{error}</p>}
      {msg && <p className="admin-note admin-note--ok">{msg}</p>}
      {!lista && !error && <p className="admin-note">Cargando…</p>}
      {lista?.length === 0 && <p className="admin-note">Aún no hay publicaciones. Crea la primera: por ejemplo, el próximo torneo o la promoción de la semana.</p>}

      <div className="pubs">
        {(lista ?? []).map((p) => {
          const [clase, texto] = estadoPub(p)
          return (
            <div key={p.id} className="pubs__item">
              <TarjetaNovedad p={p} />
              <div className="pubs__acciones">
                <span className={`pub-estado pub-estado--${clase}`}>{texto}</span>
                <button className="admin-link" onClick={() => setEditando(p)}>Editar</button>
                <button className="admin-link" onClick={() => cambiar(p, { publicado: !p.publicado })}>{p.publicado ? 'Ocultar' : 'Publicar'}</button>
                <button className="admin-link" onClick={() => cambiar(p, { destacado: !p.destacado })}>{p.destacado ? 'Quitar destacado' : 'Destacar'}</button>
                <button className="admin-link" disabled={enviando === p.id || !p.publicado} onClick={() => enviarCorreo(p)} title={p.publicado ? '' : 'Publícala primero'}>
                  {enviando === p.id ? 'Enviando…' : p.notificado_at ? `Reenviar por correo (enviada a ${p.notificados ?? 0})` : 'Enviar por correo'}
                </button>
                <button className="admin-link admin-link--peligro" onClick={() => borrar(p)}>Borrar</button>
              </div>
            </div>
          )
        })}
      </div>

      {editando && <Editor inicial={editando} rangos={rangos} onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar() }} />}
    </div>
  )
}

function Editor({ inicial, rangos, onCerrar, onGuardado }) {
  const [p, setP] = useState(inicial)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const campo = (k) => ({ value: p[k] ?? '', onChange: (e) => set(k, e.target.value) })
  const rango = rangos.find((r) => r.id === Number(p.rango_min_id))
  const vista = { ...p, rangos: rango ? { nombre: rango.nombre, color: rango.color } : null }

  async function subir(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return setError('La imagen pesa más de 5 MB.')
    setSubiendo(true); setError('')
    const nombre = `${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`
    const { error } = await supabase.storage.from('publicaciones').upload(nombre, file, { cacheControl: '31536000', upsert: false })
    setSubiendo(false)
    if (error) return setError(`No se pudo subir la imagen (${error.message}). Puedes pegar un enlace de imagen.`)
    set('imagen_url', supabase.storage.from('publicaciones').getPublicUrl(nombre).data.publicUrl)
  }

  async function guardar(e) {
    e.preventDefault()
    if (p.titulo.trim().length < 3) return setError('Escribe un título.')
    if (p.enlace && !/^https?:\/\//.test(p.enlace)) return setError('El enlace debe empezar con https://')
    setGuardando(true); setError('')
    const datos = {
      tipo: p.tipo, titulo: p.titulo.trim(), cuerpo: p.cuerpo.trim(), imagen_url: p.imagen_url?.trim() || null,
      fecha_evento: p.fecha_evento || null, lugar: p.lugar?.trim() || null, enlace: p.enlace?.trim() || null,
      enlace_texto: p.enlace_texto?.trim() || null, rango_min_id: p.rango_min_id ? Number(p.rango_min_id) : null,
      destacado: p.destacado, publicado: p.publicado, visible_desde: p.visible_desde || null, visible_hasta: p.visible_hasta || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = p.id
      ? await supabase.from('publicaciones').update(datos).eq('id', p.id)
      : await supabase.from('publicaciones').insert(datos)
    setGuardando(false)
    if (error) return setError(error.message)
    onGuardado()
  }

  return (
    <div className="admin-modal__backdrop" onClick={onCerrar}>
      <form className="admin-modal admin-modal--ancho editor-pub" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <div className="editor-pub__campos">
          <h3>{p.id ? 'Editar publicación' : 'Nueva publicación'}</h3>
          <div className="novedades__filtros">
            {Object.entries(TIPOS_PUB).map(([k, t]) => (
              <button type="button" key={k} className={p.tipo === k ? 'is-active' : ''} onClick={() => set('tipo', k)}>{t.etiqueta}</button>
            ))}
          </div>
          <label>Título<input {...campo('titulo')} maxLength={90} placeholder={p.tipo === 'evento' ? 'Torneo de Valorant 5v5' : '2×1 en horas los martes'} /></label>
          <label>Texto<textarea {...campo('cuerpo')} rows={5} placeholder="Detalles, reglas, premios, cómo participar…" /></label>

          <label>Imagen (opcional)
            <span className="editor-pub__img">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={subir} disabled={subiendo} />
              <input {...campo('imagen_url')} placeholder="…o pega el enlace de una imagen" />
            </span>
            {subiendo && <small>Subiendo…</small>}
          </label>

          {(p.tipo === 'evento' || p.fecha_evento) && (
            <div className="editor-pub__fila">
              <label>Fecha y hora del evento<input type="datetime-local" value={aLocal(p.fecha_evento)} onChange={(e) => set('fecha_evento', aISO(e.target.value))} /></label>
              <label>Lugar<input {...campo('lugar')} placeholder="Cleofas Game Center" /></label>
            </div>
          )}
          <div className="editor-pub__fila">
            <label>Botón: enlace<input {...campo('enlace')} placeholder="https://wa.me/52…" /></label>
            <label>Botón: texto<input {...campo('enlace_texto')} placeholder="Inscribirme" /></label>
          </div>
          <div className="editor-pub__fila">
            <label>¿Quién la ve?
              <select value={p.rango_min_id ?? ''} onChange={(e) => set('rango_min_id', e.target.value || null)}>
                <option value="">Todos los socios</option>
                {rangos.slice(1).map((r) => <option key={r.id} value={r.id}>Solo {r.nombre} y superiores</option>)}
              </select>
            </label>
            <label>Mostrar desde (opcional)<input type="datetime-local" value={aLocal(p.visible_desde)} onChange={(e) => set('visible_desde', aISO(e.target.value))} /></label>
            <label>Ocultar después de (opcional)<input type="datetime-local" value={aLocal(p.visible_hasta)} onChange={(e) => set('visible_hasta', aISO(e.target.value))} /></label>
          </div>
          <div className="editor-pub__checks">
            <label><input type="checkbox" checked={p.publicado} onChange={(e) => set('publicado', e.target.checked)} /> Publicada</label>
            <label><input type="checkbox" checked={p.destacado} onChange={(e) => set('destacado', e.target.checked)} /> Destacada (aparece primero y en grande)</label>
          </div>
          {error && <p className="admin-note admin-note--error">{error}</p>}
          <div className="admin-modal__actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={guardando || subiendo}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
        <div className="editor-pub__vista">
          <span className="admin-card__label">Así la verán los socios</span>
          <TarjetaNovedad p={vista} />
        </div>
      </form>
    </div>
  )
}
