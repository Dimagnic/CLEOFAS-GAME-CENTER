import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { cargarRangos, progreso, pesos, fechaCorta, ETIQUETA_MOV } from '../../lib/socios'

const normal = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Socios() {
  const [socios, setSocios] = useState(null)
  const [rangos, setRangos] = useState([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filtroRango, setFiltroRango] = useState('')
  const [abierto, setAbierto] = useState(null)

  async function cargar() {
    try {
      const [s, r] = await Promise.all([
        supabase.from('socios').select('*, rangos(nombre, color)').order('created_at', { ascending: false }).limit(1000),
        cargarRangos(),
      ])
      if (s.error) throw s.error
      setSocios(s.data); setRangos(r); setError('')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { if (supabaseReady) cargar() }, [])

  const lista = useMemo(() => {
    const t = normal(q)
    return (socios ?? []).filter((s) =>
      (!filtroRango || String(s.rango_id) === filtroRango) &&
      (!t || normal(`${s.nombre} ${s.email} ${s.telefono ?? ''} ${s.codigo}`).includes(t)))
  }, [socios, q, filtroRango])

  const stats = useMemo(() => {
    const todos = socios ?? []
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0)
    return {
      total: todos.length,
      nuevos: todos.filter((s) => new Date(s.created_at) >= mes).length,
      puntos: todos.reduce((a, s) => a + s.puntos, 0),
      porRango: rangos.map((r) => ({ ...r, n: todos.filter((s) => s.rango_id === r.id).length })),
    }
  }, [socios, rangos])

  function exportar() {
    const filas = [['Nombre', 'Correo', 'Teléfono', 'Código', 'Rango', 'Puntos', 'Alta']]
    for (const s of lista) filas.push([s.nombre, s.email, s.telefono ?? '', s.codigo, s.rangos?.nombre ?? '', s.puntos, s.created_at.slice(0, 10)])
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `socios-cleofas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  if (!supabaseReady) return <div><header className="admin-page__head"><h1>Socios</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>

  return (
    <div>
      <header className="admin-page__head">
        <h1>Socios del club</h1>
        <p>Clientes registrados en la página, su rango, sus puntos y todo lo que han consumido.</p>
      </header>

      {error && <p className="admin-note admin-note--error">Error: {error}. ¿Ya ejecutaste <code>supabase/migration-socios.sql</code>?</p>}

      <div className="admin-cards">
        <div className="admin-card"><p className="admin-card__label">Socios</p><p className="admin-card__value">{stats.total}</p></div>
        <div className="admin-card"><p className="admin-card__label">Nuevos este mes</p><p className="admin-card__value">{stats.nuevos}</p></div>
        <div className="admin-card"><p className="admin-card__label">Puntos en circulación</p><p className="admin-card__value">{stats.puntos.toLocaleString('es-MX')}</p></div>
        <div className="admin-card">
          <p className="admin-card__label">Por rango</p>
          <div className="socios-rangos">
            {stats.porRango.map((r) => <span key={r.id} style={{ '--rango': r.color }}><i />{r.nombre} <b>{r.n}</b></span>)}
          </div>
        </div>
      </div>

      <div className="admin-form-inline">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo, teléfono o código" />
        <select value={filtroRango} onChange={(e) => setFiltroRango(e.target.value)}>
          <option value="">Todos los rangos</option>
          {rangos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={exportar} disabled={!lista.length}>Exportar CSV</button>
      </div>

      {!socios && !error ? <p className="admin-note">Cargando…</p> : lista.length === 0 ? (
        <p className="admin-note">{socios?.length ? 'Ningún socio coincide con la búsqueda.' : 'Aún no hay socios. Cuando alguien cree su cuenta en la página aparecerá aquí.'}</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Socio</th><th>Teléfono</th><th>Código</th><th>Rango</th><th>Puntos</th><th>Alta</th><th></th></tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.user_id} className="admin-table__click" onClick={() => setAbierto(s.user_id)}>
                <td><strong>{s.nombre || '—'}</strong><br /><span className="mono">{s.email}</span></td>
                <td>{s.telefono || '—'}</td>
                <td className="mono">{s.codigo}</td>
                <td><span className="rango-pill" style={{ '--rango': s.rangos?.color || '#9FB0CC' }}>{s.rangos?.nombre ?? '—'}{s.rango_manual ? ' ★' : ''}</span></td>
                <td>{s.puntos.toLocaleString('es-MX')}</td>
                <td className="mono">{s.created_at.slice(0, 10)}</td>
                <td><button className="admin-link">Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {abierto && <DetalleSocio id={abierto} rangos={rangos} onCerrar={() => setAbierto(null)} onCambio={cargar} />}
    </div>
  )
}

function DetalleSocio({ id, rangos, onCerrar, onCambio }) {
  const { session } = useAuth()
  const [s, setS] = useState(null)
  const [movs, setMovs] = useState([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function cargar() {
    const [a, b] = await Promise.all([
      supabase.from('socios').select('*').eq('user_id', id).single(),
      supabase.from('movimientos').select('*').eq('socio_id', id).order('created_at', { ascending: false }).limit(200),
    ])
    if (a.error) return setError(a.error.message)
    setS(a.data); setMovs(b.data ?? [])
  }
  useEffect(() => { cargar() }, [id])

  async function guardar(cambios, texto) {
    setError(''); setMsg('')
    const { error } = await supabase.from('socios').update(cambios).eq('user_id', id)
    if (error) return setError(error.message)
    setMsg(texto); await cargar(); onCambio()
  }

  async function ajustar(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const puntos = Math.trunc(Number(f.get('puntos')))
    const motivo = String(f.get('motivo')).trim()
    if (!puntos) return setError('Escribe cuántos puntos (usa negativo para restar).')
    if (motivo.length < 3) return setError('Escribe el motivo del ajuste.')
    setError(''); setMsg('')
    const { error } = await supabase.from('movimientos').insert({
      socio_id: id, tipo: 'ajuste', descripcion: motivo, monto: 0, puntos, creado_por: session?.user?.email ?? 'panel',
    })
    if (error) return setError(error.message)
    e.target.reset()
    setMsg(`${puntos > 0 ? 'Se sumaron' : 'Se restaron'} ${Math.abs(puntos)} puntos.`)
    await cargar(); onCambio()
  }

  const p = s && rangos.length ? progreso(rangos, s.puntos, s.rango_id) : null
  const gastado = movs.reduce((a, m) => a + (m.tipo !== 'ajuste' ? Number(m.monto || 0) : 0), 0)
  const visitas = movs.filter((m) => m.tipo === 'sesion' || m.tipo === 'reserva').length
  const ultima = movs.find((m) => m.tipo !== 'ajuste')

  return (
    <div className="admin-modal__backdrop" onClick={onCerrar}>
      <div className="admin-modal admin-modal--ancho" onClick={(e) => e.stopPropagation()}>
        {!s ? <p className="admin-note">{error || 'Cargando…'}</p> : (
          <>
            <div className="socio-detalle__head" style={{ '--rango': p?.actual?.color || '#9FB0CC' }}>
              <div>
                <h3>{s.nombre || s.email}</h3>
                <p className="mono">{s.email}{s.telefono ? ` · ${s.telefono}` : ''} · {s.codigo}</p>
              </div>
              <span className="rango-pill">{p?.actual?.nombre}{s.rango_manual ? ' ★ manual' : ''}</span>
            </div>

            <div className="admin-cards admin-cards--4">
              <div className="admin-card"><p className="admin-card__label">Puntos</p><p className="admin-card__value">{s.puntos.toLocaleString('es-MX')}</p></div>
              <div className="admin-card"><p className="admin-card__label">Consumo total</p><p className="admin-card__value">{pesos(gastado)}</p></div>
              <div className="admin-card"><p className="admin-card__label">Visitas</p><p className="admin-card__value">{visitas}</p></div>
              <div className="admin-card"><p className="admin-card__label">Última visita</p><p className="admin-card__value admin-card__value--sm">{ultima ? fechaCorta(ultima.created_at) : '—'}</p></div>
            </div>
            {p?.siguiente && (
              <p className="admin-note">Le faltan <strong>{p.faltan} pts</strong> para <strong>{p.siguiente.nombre}</strong> ({Math.round(p.avance * 100)}%).</p>
            )}

            {error && <p className="admin-note admin-note--error">{error}</p>}
            {msg && <p className="admin-note admin-note--ok">{msg}</p>}

            <div className="socio-detalle__grid">
              <section>
                <h4>Rango</h4>
                <select value={s.rango_manual ? String(s.rango_id) : 'auto'}
                  onChange={(e) => e.target.value === 'auto'
                    ? guardar({ rango_manual: false }, 'Rango automático: se calcula con sus puntos.')
                    : guardar({ rango_manual: true, rango_id: Number(e.target.value) }, 'Rango fijado manualmente.')}>
                  <option value="auto">Automático (por puntos)</option>
                  {rangos.map((r) => <option key={r.id} value={r.id}>Fijar en {r.nombre}</option>)}
                </select>
                <p className="socio-picker__nota">Fijado a mano, el rango no sube ni baja con los puntos hasta que lo regreses a automático.</p>
              </section>
              <section>
                <h4>Ajustar puntos</h4>
                <form className="socio-detalle__ajuste" onSubmit={ajustar}>
                  <input name="puntos" type="number" step="1" placeholder="+100 o -50" />
                  <input name="motivo" placeholder="Motivo (ej. bono de cumpleaños)" />
                  <button className="btn btn-primary btn-sm">Aplicar</button>
                </form>
              </section>
              <section className="socio-detalle__notas">
                <h4>Notas internas</h4>
                <textarea defaultValue={s.notas ?? ''} rows={2} placeholder="Solo las ve el equipo"
                  onBlur={(e) => e.target.value !== (s.notas ?? '') && guardar({ notas: e.target.value }, 'Notas guardadas.')} />
              </section>
            </div>

            <h4>Historial</h4>
            {movs.length === 0 ? <p className="admin-note">Sin movimientos todavía.</p> : (
              <div className="socio-detalle__historial">
                <table className="admin-table">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Monto</th><th>Puntos</th></tr></thead>
                  <tbody>
                    {movs.map((m) => (
                      <tr key={m.id}>
                        <td className="mono">{fechaCorta(m.created_at)}</td>
                        <td>{ETIQUETA_MOV[m.tipo]}</td>
                        <td>{m.descripcion}{m.creado_por && m.tipo === 'ajuste' ? <span className="mono"> · {m.creado_por}</span> : null}</td>
                        <td>{Number(m.monto) ? pesos(m.monto) : '—'}</td>
                        <td className={m.puntos < 0 ? 'txt-neg' : 'txt-pos'}>{m.puntos > 0 ? '+' : ''}{m.puntos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="admin-modal__actions"><button className="btn btn-ghost btn-sm" onClick={onCerrar}>Cerrar</button></div>
          </>
        )}
      </div>
    </div>
  )
}
