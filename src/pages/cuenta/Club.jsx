import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { TIPOS_PUB, estadoCupon, textoCupon, fechaDia } from '../../lib/socios'

const fechaEvento = (iso) =>
  new Date(iso).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

function diaMes(iso) {
  const d = new Date(iso)
  const o = { timeZone: 'America/Mexico_City' }
  return { dia: d.toLocaleDateString('es-MX', { ...o, day: 'numeric' }), mes: d.toLocaleDateString('es-MX', { ...o, month: 'short' }).replace('.', '') }
}

// Tarjeta de noticia / evento / promoción / comunicado (la usa también la vista previa del panel)
export function TarjetaNovedad({ p }) {
  const t = TIPOS_PUB[p.tipo] ?? TIPOS_PUB.noticia
  const proximo = p.tipo === 'evento' && p.fecha_evento && new Date(p.fecha_evento).getTime() > Date.now()
  const dm = p.fecha_evento ? diaMes(p.fecha_evento) : null
  return (
    <article className={`novedad ${p.destacado ? 'novedad--destacada' : ''} ${p.imagen_url ? 'novedad--imagen' : ''}`} style={{ '--tipo': t.color }}>
      {p.imagen_url && (
        <div className="novedad__img">
          <img src={p.imagen_url} alt="" loading="lazy" />
          {dm && <span className="novedad__fecha"><b>{dm.dia}</b>{dm.mes}</span>}
        </div>
      )}
      <div className="novedad__cuerpo">
        <div className="novedad__meta">
          <span className="novedad__tipo">{t.etiqueta}</span>
          {p.destacado && <span className="novedad__flag">Destacado</span>}
          {p.rangos?.nombre && <span className="novedad__exclusivo" style={{ '--rango': p.rangos.color }}>Exclusivo {p.rangos.nombre}+</span>}
          {proximo && <span className="novedad__flag novedad__flag--pronto">Próximamente</span>}
        </div>
        <h3>{p.titulo || 'Sin título'}</h3>
        {p.fecha_evento && (
          <p className="novedad__cuando">
            {fechaEvento(p.fecha_evento)}{p.lugar ? ` · ${p.lugar}` : ''}
          </p>
        )}
        {p.cuerpo && <p className="novedad__texto">{p.cuerpo}</p>}
        <div className="novedad__pie">
          {p.enlace && <a className="btn btn-primary btn-sm" href={p.enlace} target="_blank" rel="noopener noreferrer">{p.enlace_texto || 'Más información'}</a>}
          {p.visible_hasta && <span className="novedad__vigencia">Válido hasta {fechaDia(p.visible_hasta)}</span>}
        </div>
      </div>
    </article>
  )
}

const FILTROS = [['todo', 'Todo'], ['promocion', 'Promociones'], ['evento', 'Eventos'], ['noticia', 'Noticias'], ['comunicado', 'Comunicados']]

export function Novedades({ publicaciones }) {
  const [filtro, setFiltro] = useState('todo')
  const lista = useMemo(() => publicaciones.filter((p) => filtro === 'todo' || p.tipo === filtro), [publicaciones, filtro])
  const hay = (tipo) => tipo === 'todo' || publicaciones.some((p) => p.tipo === tipo)

  return (
    <section className="cuenta-panel">
      <div className="cuenta-panel__head">
        <h2>Novedades del club</h2>
        {publicaciones.length > 0 && (
          <div className="novedades__filtros" role="tablist">
            {FILTROS.filter(([k]) => hay(k)).map(([k, txt]) => (
              <button key={k} role="tab" aria-selected={filtro === k} className={filtro === k ? 'is-active' : ''} onClick={() => setFiltro(k)}>{txt}</button>
            ))}
          </div>
        )}
      </div>
      {publicaciones.length === 0 ? (
        <p className="cuenta-muted">Aquí verás promociones, torneos, eventos y avisos del Club Cleofas. ¡Pronto habrá novedades!</p>
      ) : (
        <div className="novedades">{lista.map((p) => <TarjetaNovedad key={p.id} p={p} />)}</div>
      )}
    </section>
  )
}

export function TarjetaCupon({ c }) {
  const estado = estadoCupon(c)
  return (
    <div className={`cupon cupon--${estado}`}>
      <div className="cupon__valor">
        <b>{c.tipo === 'porcentaje' ? `${Number(c.valor)}%` : `$${Number(c.valor)}`}</b>
        <span>{c.aplica === 'horas' ? 'horas' : c.aplica === 'snacks' ? 'snacks' : 'todo'}</span>
      </div>
      <div className="cupon__info">
        <strong>{c.titulo}</strong>
        <span>{c.descripcion || textoCupon(c)}</span>
        <code>{c.codigo}</code>
        <em>
          {estado === 'disponible' && (c.vence_at ? `Vence el ${fechaDia(c.vence_at)}` : 'Sin vencimiento')}
          {estado === 'usado' && `Usado el ${fechaDia(c.usado_at)}`}
          {estado === 'vencido' && `Venció el ${fechaDia(c.vence_at)}`}
          {estado === 'anulado' && 'Anulado'}
        </em>
      </div>
    </div>
  )
}

export function MisCupones({ cupones }) {
  const [verTodos, setVerTodos] = useState(false)
  const disponibles = cupones.filter((c) => estadoCupon(c) === 'disponible')
  const otros = cupones.filter((c) => estadoCupon(c) !== 'disponible')
  return (
    <section className="cuenta-panel">
      <div className="cuenta-panel__head">
        <h2>Mis cupones {disponibles.length > 0 && <span className="cuenta-contador">{disponibles.length}</span>}</h2>
        {otros.length > 0 && <button className="cuenta-link" onClick={() => setVerTodos((v) => !v)}>{verTodos ? 'Ocultar usados' : `Usados y vencidos (${otros.length})`}</button>}
      </div>
      {disponibles.length === 0 ? (
        <p className="cuenta-muted">No tienes cupones disponibles por ahora. Los cupones llegan con promociones, eventos y al subir de rango.</p>
      ) : (
        <>
          <div className="cupones">{disponibles.map((c) => <TarjetaCupon key={c.id} c={c} />)}</div>
          <p className="cuenta-nota">Úsalos al reservar en línea con tu sesión iniciada, o muestra tu QR de socio en mostrador y pide que los apliquen.</p>
        </>
      )}
      {verTodos && otros.length > 0 && <div className="cupones cupones--historial">{otros.map((c) => <TarjetaCupon key={c.id} c={c} />)}</div>}
    </section>
  )
}

// Próximas reservas pagadas del socio, con su pedido de tienda
export function MisReservas({ uid }) {
  const [reservas, setReservas] = useState(null)
  useEffect(() => {
    if (!uid) return
    const consulta = (campos) => supabase.from('reservaciones').select(campos)
      .eq('socio_id', uid).eq('estado', 'confirmada').gte('fin', new Date().toISOString()).order('inicio').limit(10)
    consulta('folio, estacion, inicio, fin, duracion_h, snacks_pago, snacks_estado, snacks_total, reserva_productos(nombre, cantidad)')
      .then(({ data, error }) => (error ? consulta('folio, estacion, inicio, fin, duracion_h') : { data }))
      .then(({ data }) => setReservas(data ?? []), () => setReservas([]))
  }, [uid])

  if (!reservas?.length) return null
  const cuando = (iso) => new Date(iso).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })
  return (
    <section className="cuenta-panel">
      <h2>Mis próximas reservas</h2>
      <div className="mis-reservas">
        {reservas.map((r) => (
          <div key={r.folio} className="mis-reservas__item">
            <div>
              <strong>{r.estacion} · {r.duracion_h} h</strong>
              <span className="mis-reservas__cuando">{cuando(r.inicio)}</span>
              <code>{r.folio}</code>
            </div>
            {r.snacks_pago && (
              <div className="mis-reservas__pedido">
                <span>Tu pedido: {(r.reserva_productos ?? []).map((p) => `${p.cantidad}× ${p.nombre}`).join(', ')}</span>
                <b className={r.snacks_estado === 'pagado' ? 'ok' : 'efectivo'}>
                  {r.snacks_estado === 'pagado' ? 'Pagado' : `$${Number(r.snacks_total)} en efectivo al llegar`}
                </b>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
