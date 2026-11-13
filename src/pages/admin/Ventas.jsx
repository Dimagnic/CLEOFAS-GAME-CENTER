import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { listarVentas, estadoVenta, pesos, METODOS, ORIGENES, inicioDeHoy } from '../../lib/ventas'
import { fechaCorta } from '../../lib/socios'
import DetalleVenta from './DetalleVenta'
import { cargarConfigTicket } from './Hardware'

const hoyMX = (dias = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(Date.now() - dias * 86400000))
const RANGOS = [['hoy', 'Hoy', 0], ['7d', '7 días', 6], ['30d', '30 días', 29], ['90d', '90 días', 89]]

export default function Ventas() {
  const [tab, setTab] = useState('historial')
  const [cfg, setCfg] = useState({})
  useEffect(() => { cargarConfigTicket().then(setCfg) }, [])
  if (!supabaseReady) return <div><header className="admin-page__head"><h1>Ventas</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>
  return (
    <div>
      <header className="admin-page__head">
        <h1>Ventas y reportes</h1>
        <p>Todas las transacciones: mostrador, tienda en línea y productos de reservas.</p>
      </header>
      <div className="novedades__filtros admin-tabs">
        <button className={tab === 'historial' ? 'is-active' : ''} onClick={() => setTab('historial')}>Historial</button>
        <button className={tab === 'reportes' ? 'is-active' : ''} onClick={() => setTab('reportes')}>Reportes</button>
      </div>
      {tab === 'historial' ? <Historial cfg={cfg} /> : <Reportes />}
    </div>
  )
}

function Historial({ cfg }) {
  const [ventas, setVentas] = useState(null)
  const [error, setError] = useState('')
  const [rango, setRango] = useState('7d')
  const [estado, setEstado] = useState('')
  const [metodo, setMetodo] = useState('')
  const [origen, setOrigen] = useState('')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const dias = RANGOS.find((r) => r[0] === rango)[2]
      setVentas(await listarVentas({ estado, metodo, origen, desde: inicioDeHoy(dias), limite: 1000 }))
      setError('')
    } catch (e) { setError(`${e.message}. ¿Ya ejecutaste supabase/migration-pos.sql?`) }
  }, [rango, estado, metodo, origen])
  useEffect(() => {
    cargar()
    const canal = supabase.channel('ventas-historial').on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, cargar).subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [cargar])

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (ventas ?? []).filter((v) => !t || `${v.folio} ${v.cliente ?? ''} ${v.socios?.email ?? ''} ${v.reservaciones?.folio ?? ''}`.toLowerCase().includes(t))
  }, [ventas, q])
  const pagadas = lista.filter((v) => v.estado === 'pagada')
  const total = pagadas.reduce((s, v) => s + Number(v.total), 0)

  return (
    <section>
      <div className="admin-form-inline">
        <select value={rango} onChange={(e) => setRango(e.target.value)}>{RANGOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option><option value="pendiente">Pendientes</option><option value="pagada">Pagadas</option><option value="cancelada">Canceladas</option>
        </select>
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
          <option value="">Todos los métodos</option>{Object.entries(METODOS).map(([k, m]) => <option key={k} value={k}>{m.etiqueta}</option>)}
        </select>
        <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
          <option value="">Todos los orígenes</option>{Object.entries(ORIGENES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Folio, cliente o reserva" />
      </div>
      {error && <p className="admin-note admin-note--error">{error}</p>}
      <p className="admin-note">{pagadas.length} ventas pagadas · {pesos(total)} en el periodo mostrado.</p>
      {!ventas && !error ? <p className="admin-note">Cargando…</p> : lista.length === 0 ? <p className="admin-note">Sin ventas con ese filtro.</p> : (
        <table className="admin-table">
          <thead><tr><th>Folio</th><th>Fecha</th><th>Origen</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Pago</th><th>Estado</th></tr></thead>
          <tbody>
            {lista.map((v) => {
              const [clase, texto] = estadoVenta(v)
              return (
                <tr key={v.id} className="admin-table__click" onClick={() => setAbierta(v)}>
                  <td className="mono">{v.folio}</td>
                  <td className="mono">{fechaCorta(v.pagada_at || v.created_at)}</td>
                  <td>{ORIGENES[v.origen]}{v.reservaciones ? <><br /><span className="mono">{v.reservaciones.folio}</span></> : null}</td>
                  <td>{v.cliente || '—'}{v.socio_id ? <span className="mono"> · socio</span> : null}</td>
                  <td className="venta-items-cel">{(v.venta_items ?? []).map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}</td>
                  <td>{pesos(v.total)}</td>
                  <td>{v.metodo_pago ? METODOS[v.metodo_pago].corto : '—'}</td>
                  <td><span className={`venta-estado venta-estado--${clase}`}>{texto}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {abierta && <DetalleVenta venta={abierta} cfg={cfg} onCerrar={() => setAbierta(null)} onCambio={cargar} />}
    </section>
  )
}

function Reportes() {
  const [desde, setDesde] = useState(hoyMX(29))
  const [hasta, setHasta] = useState(hoyMX())
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta }).then(({ data, error }) => {
      if (error) setError(error.message); else { setError(''); setR(data) }
    })
  }, [desde, hasta])
  const maxDia = Math.max(1, ...(r?.por_dia ?? []).map((d) => Number(d.total)))
  const utilidad = r ? Number(r.total) - Number(r.costo) : 0

  return (
    <section>
      <div className="admin-form-inline">
        {RANGOS.map(([k, t, d]) => <button key={k} className="btn btn-ghost btn-sm" onClick={() => { setDesde(hoyMX(d)); setHasta(hoyMX()) }}>{t}</button>)}
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </div>
      {error && <p className="admin-note admin-note--error">{error}</p>}
      {!r ? <p className="admin-note">Cargando…</p> : (
        <>
          <div className="admin-cards">
            <div className="admin-card"><p className="admin-card__label">Ventas de tienda</p><p className="admin-card__value">{pesos(r.total)}</p></div>
            <div className="admin-card"><p className="admin-card__label">Transacciones</p><p className="admin-card__value">{r.ventas}</p></div>
            <div className="admin-card"><p className="admin-card__label">Ticket promedio</p><p className="admin-card__value">{pesos(r.ticket_promedio)}</p></div>
            <div className="admin-card"><p className="admin-card__label">Utilidad bruta</p><p className="admin-card__value">{pesos(utilidad)}</p></div>
          </div>
          <div className="reporte-grid">
            <div className="admin-card">
              <p className="admin-card__label">Ventas por día</p>
              {r.por_dia.length === 0 ? <p className="admin-note">Sin ventas en el periodo.</p> : (
                <div className="reporte-barras">
                  {r.por_dia.map((d) => (
                    <div key={d.dia} title={`${d.dia}: ${pesos(d.total)} (${d.ventas} ventas)`}>
                      <i style={{ height: `${Math.max(4, (Number(d.total) / maxDia) * 100)}%` }} />
                      <span>{d.dia.slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-card">
              <p className="admin-card__label">Por método de pago</p>
              {Object.entries(r.por_metodo).map(([k, t]) => <p key={k} className="reporte-fila"><span>{METODOS[k]?.etiqueta ?? k}</span><b>{pesos(t)}</b></p>)}
              <p className="admin-card__label reporte-sub">Por origen</p>
              {Object.entries(r.por_origen).map(([k, t]) => <p key={k} className="reporte-fila"><span>{ORIGENES[k] ?? k}</span><b>{pesos(t)}</b></p>)}
              <p className="reporte-fila reporte-sub"><span>Descuentos otorgados</span><b>{pesos(r.descuentos)}</b></p>
            </div>
          </div>
          <section className="admin-section">
            <h2>Productos más vendidos</h2>
            {r.top.length === 0 ? <p className="admin-note">Sin ventas en el periodo.</p> : (
              <table className="admin-table">
                <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Importe</th><th>Utilidad</th></tr></thead>
                <tbody>{r.top.map((t, i) => <tr key={t.nombre}><td>{i + 1}</td><td>{t.nombre}</td><td>{t.unidades}</td><td>{pesos(t.importe)}</td><td>{pesos(t.utilidad)}</td></tr>)}</tbody>
              </table>
            )}
            <p className="socio-picker__nota">La utilidad usa el costo capturado en Inventario. Los productos sin costo cuentan como 100% utilidad.</p>
          </section>
        </>
      )}
    </section>
  )
}
