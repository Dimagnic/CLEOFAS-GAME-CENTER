import { useEffect, useMemo, useState } from 'react'
import { useEstacionesPublicas } from '../lib/estacionesPublicas'
import {
  HORA_ABRE, HORA_CIERRA, MAX_HORAS, precioPorHoras, ahoraMX, sumarDias, api,
} from '../lib/reservas'
import './Booking.css'

export default function Booking() {
  const [tab, setTab] = useState('reservar')
  const [retorno, setRetorno] = useState(null) // { pago: 'ok' | 'cancelado', folio }

  // Al volver de Stripe la URL trae ?pago=ok|cancelado&folio=CL-XXXXX
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const pago = q.get('pago')
    const folio = q.get('folio')
    if (pago && folio) {
      setRetorno({ pago, folio })
      window.history.replaceState({}, '', window.location.pathname + '#reservar')
    }
  }, [])

  return (
    <section id="reservar" className="section booking">
      <div className="wrap booking__grid">
        <div>
          <p className="eyebrow">Sin filas en la entrada</p>
          <h2 className="booking__title">Reserva y paga tu turno desde aquí</h2>
          <p className="booking__lead">
            Elige tu estación y tu horario, paga en línea y listo: tu lugar queda
            apartado y el encargado lo ve al instante en el panel del negocio.
          </p>

          <div className="booking__tabs">
            <button className={tab === 'reservar' ? 'is-active' : ''} onClick={() => setTab('reservar')}>
              Reservar
            </button>
            <button className={tab === 'consultar' ? 'is-active' : ''} onClick={() => setTab('consultar')}>
              Consultar folio
            </button>
          </div>
        </div>

        <div className="booking__card">
          {retorno ? (
            <Retorno retorno={retorno} onCerrar={() => setRetorno(null)} />
          ) : tab === 'reservar' ? (
            <FormReserva />
          ) : (
            <ConsultaFolio />
          )}
        </div>
      </div>
    </section>
  )
}

function FormReserva() {
  const hoy = useMemo(() => ahoraMX(), [])
  const { estaciones } = useEstacionesPublicas()
  const libres = estaciones.filter((e) => e.estado !== 'mantenimiento')
  const [estacion, setEstacion] = useState('')
  const [fecha, setFecha] = useState(hoy.fecha)
  const [duracion, setDuracion] = useState(1)
  const [inicio, setInicio] = useState(null)
  const [ocupadas, setOcupadas] = useState([])
  const [cargandoDisp, setCargandoDisp] = useState(false)
  const [errorDisp, setErrorDisp] = useState('')
  const [error, setError] = useState('')
  const [pagando, setPagando] = useState(false)

  function cargarDisponibilidad() {
    if (!estacion || !fecha) return Promise.resolve()
    setCargandoDisp(true)
    setErrorDisp('')
    return api(`/api/availability?estacion=${estacion}&fecha=${fecha}`)
      .then((d) => setOcupadas(d.ocupadas))
      .catch(() => setErrorDisp('No pudimos consultar la disponibilidad. Intenta de nuevo en un momento.'))
      .finally(() => setCargandoDisp(false))
  }

  useEffect(() => {
    setInicio(null)
    setOcupadas([])
    cargarDisponibilidad()
  }, [estacion, fecha])

  const horas = Array.from({ length: HORA_CIERRA - HORA_ABRE }, (_, i) => HORA_ABRE + i)
  const noDisponible = (h) => ocupadas.includes(h) || (fecha === hoy.fecha && h <= hoy.hora)
  const rangoLibre = (h, d) => {
    for (let x = h; x < h + d; x++) if (x >= HORA_CIERRA || noDisponible(x)) return false
    return true
  }
  const total = precioPorHoras(duracion)
  const listo = estacion && inicio !== null && rangoLibre(inicio, duracion)

  function cambiarDuracion(d) {
    setDuracion(d)
    if (inicio !== null && !rangoLibre(inicio, d)) setInicio(null)
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!listo) return
    setError('')
    setPagando(true)
    const f = new FormData(e.target)
    try {
      const { url } = await api('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: f.get('cliente'),
          email: f.get('email'),
          telefono: f.get('telefono'),
          estacion, fecha, hora: inicio, duracion,
        }),
      })
      window.location.href = url // pago seguro en Stripe
    } catch (err) {
      setError(err.message)
      setPagando(false)
      cargarDisponibilidad()
    }
  }

  return (
    <form className="booking__form" onSubmit={onSubmit}>
      <label>
        Nombre
        <input name="cliente" required maxLength={80} placeholder="¿A nombre de quién?" />
      </label>
      <div className="booking__row">
        <label>
          Correo
          <input type="email" name="email" required placeholder="Para tu comprobante" />
        </label>
        <label>
          Teléfono (opcional)
          <input type="tel" name="telefono" placeholder="222 000 0000" />
        </label>
      </div>

      <div className="booking__row">
        <label>
          Estación
          <select value={estacion} onChange={(e) => setEstacion(e.target.value)} required>
            <option value="" disabled>Elige una</option>
            {libres.map((e) => (
              <option key={e.id} value={e.id}>{e.id} — {e.tipo}</option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input
            type="date" required value={fecha}
            min={hoy.fecha} max={sumarDias(hoy.fecha, 60)}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
          />
        </label>
      </div>

      <label>
        Duración
        <select value={duracion} onChange={(e) => cambiarDuracion(Number(e.target.value))}>
          {Array.from({ length: MAX_HORAS }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>{h} {h === 1 ? 'hora' : 'horas'} — ${precioPorHoras(h)} MXN</option>
          ))}
        </select>
      </label>

      <div className="booking__slotsbox">
        <span className="booking__slotslabel">Hora de inicio</span>
        {!estacion ? (
          <p className="booking__hint">Elige una estación para ver los horarios libres.</p>
        ) : (
          <div className="booking__slots" aria-busy={cargandoDisp}>
            {horas.map((h) => {
              const bloqueada = cargandoDisp || noDisponible(h) || !rangoLibre(h, duracion)
              return (
                <button
                  type="button" key={h} disabled={bloqueada}
                  className={`slot ${inicio === h ? 'is-active' : ''}`}
                  onClick={() => setInicio(h)}
                >
                  {h}:00
                </button>
              )
            })}
          </div>
        )}
        {errorDisp && <p className="booking__error">{errorDisp}</p>}
        {estacion && !cargandoDisp && !errorDisp && horas.every((h) => noDisponible(h) || !rangoLibre(h, duracion)) && (
          <p className="booking__hint">No hay horarios de {duracion} h disponibles ese día. Prueba otra fecha o estación.</p>
        )}
      </div>

      {error && <p className="booking__error" role="alert">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={!listo || pagando}>
        {pagando ? 'Redirigiendo al pago…' : listo ? `Pagar $${total} MXN y reservar` : 'Elige estación y hora'}
      </button>
      <p className="booking__hint">
        Pago seguro con Stripe. Tu horario se aparta 30 minutos mientras pagas.
        Horario: todos los días de {HORA_ABRE}:00 a {HORA_CIERRA}:00.
      </p>
    </form>
  )
}

function Retorno({ retorno, onCerrar }) {
  const [res, setRes] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    async function correr() {
      try {
        if (retorno.pago === 'cancelado') {
          const r = await api('/api/reservation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folio: retorno.folio }),
          })
          if (vivo) setRes(r)
          return
        }
        // Pago exitoso: el webhook puede tardar unos segundos, así que reintentamos.
        for (let i = 0; i < 8 && vivo; i++) {
          const r = await api(`/api/reservation?folio=${retorno.folio}`)
          if (!vivo) return
          setRes(r)
          if (r.estado !== 'pendiente_pago') return
          await new Promise((ok) => setTimeout(ok, 2000))
        }
      } catch (e) {
        if (vivo) setError(e.message)
      }
    }
    correr()
    return () => { vivo = false }
  }, [retorno])

  if (error) {
    return (
      <div className="booking__confirm">
        <p className="booking__error">{error}</p>
        <p>Si ya pagaste, guarda tu folio <strong className="mono">{retorno.folio}</strong> y escríbenos por WhatsApp.</p>
        <button className="btn btn-ghost" onClick={onCerrar}>Volver</button>
      </div>
    )
  }

  if (retorno.pago === 'cancelado' || res?.estado === 'expirada' || res?.estado === 'cancelada') {
    return (
      <div className="booking__confirm">
        <p className="eyebrow">Pago cancelado</p>
        <p>No se hizo ningún cargo y tu horario fue liberado. Puedes intentarlo de nuevo cuando quieras.</p>
        <button className="btn btn-primary" onClick={onCerrar}>Elegir otro horario</button>
      </div>
    )
  }

  if (!res || res.estado === 'pendiente_pago') {
    return (
      <div className="booking__confirm">
        <p className="eyebrow">Confirmando tu pago…</p>
        <p className="booking__folio">{retorno.folio}</p>
        <p>Esto toma unos segundos. No cierres esta página.</p>
      </div>
    )
  }

  return (
    <div className="booking__confirm">
      <p className="eyebrow">¡Reservación confirmada!</p>
      <p className="booking__folio">{res.folio}</p>
      <dl className="booking__resumen">
        <div><dt>Estación</dt><dd>{res.estacion}</dd></div>
        <div><dt>Cuándo</dt><dd>{res.fecha} · {res.hora}</dd></div>
        <div><dt>Duración</dt><dd>{res.duracionH} h</dd></div>
        <div><dt>Pagado</dt><dd>${res.monto} MXN</dd></div>
      </dl>
      <p>Guarda tu folio y muéstralo al llegar. ¡Te esperamos con tu estación lista!</p>
      <button className="btn btn-ghost" onClick={onCerrar}>Hacer otra reservación</button>
    </div>
  )
}

function ConsultaFolio() {
  const [folio, setFolio] = useState('')
  const [resultado, setResultado] = useState(undefined)
  const [buscando, setBuscando] = useState(false)

  async function buscar(e) {
    e.preventDefault()
    setBuscando(true)
    try {
      setResultado(await api(`/api/reservation?folio=${encodeURIComponent(folio.trim())}`))
    } catch {
      setResultado(null)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div>
      <form className="booking__lookup" onSubmit={buscar}>
        <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Tu folio, ej. CL-7K3MQ" />
        <button type="submit" className="btn btn-primary" disabled={buscando}>{buscando ? '…' : 'Buscar'}</button>
      </form>

      {resultado === null && <p className="booking__hint">No encontramos ese folio. Revisa que esté completo.</p>}

      {resultado && (
        <div className="booking__result">
          <p className="booking__folio">{resultado.folio}</p>
          <dl>
            <div><dt>Cliente</dt><dd>{resultado.cliente}</dd></div>
            <div><dt>Estación</dt><dd>{resultado.estacion}</dd></div>
            <div><dt>Fecha</dt><dd>{resultado.fecha} · {resultado.hora}</dd></div>
            <div><dt>Estado</dt><dd className={`estado-pill estado-pill--${resultado.estado}`}>{ETIQUETAS[resultado.estado] ?? resultado.estado}</dd></div>
          </dl>
        </div>
      )}
    </div>
  )
}

const ETIQUETAS = {
  confirmada: 'confirmada',
  pendiente: 'pendiente',
  pendiente_pago: 'esperando pago',
  cancelada: 'cancelada',
  expirada: 'expirada',
}
