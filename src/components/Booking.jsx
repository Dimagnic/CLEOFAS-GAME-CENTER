import { useState } from 'react'
import { supabase, supabaseReady } from '../lib/supabaseClient'
import { RESERVACIONES, ESTACIONES } from '../data/mockData'
import './Booking.css'

const libres = ESTACIONES.filter((e) => e.estado !== 'mantenimiento')

export default function Booking() {
  const [tab, setTab] = useState('reservar')

  return (
    <section id="reservar" className="section booking">
      <div className="wrap booking__grid">
        <div>
          <p className="eyebrow">Sin filas en la entrada</p>
          <h2 className="booking__title">Reserva o consulta tu turno desde aquí</h2>
          <p className="booking__lead">
            Antes, apartar una estación significaba llamar o venir a preguntar.
            Ahora se hace en un minuto, y el encargado ve tu reservación directo
            en el panel del negocio.
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
          {tab === 'reservar' ? <FormReserva /> : <ConsultaFolio />}
        </div>
      </div>
    </section>
  )
}

function FormReserva() {
  const [enviado, setEnviado] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setCargando(true)
    const form = new FormData(e.target)
    const folio = 'CL-' + Math.floor(1000 + Math.random() * 9000)
    const payload = {
      folio,
      cliente: form.get('cliente'),
      estacion: form.get('estacion'),
      fecha: form.get('fecha'),
      hora: form.get('hora'),
      duracion_h: Number(form.get('duracion')),
      estado: 'pendiente',
    }

    if (supabaseReady) {
      const { error } = await supabase.from('reservaciones').insert(payload)
      if (error) console.error(error)
    }

    setCargando(false)
    setEnviado(folio)
  }

  if (enviado) {
    return (
      <div className="booking__confirm">
        <p className="eyebrow">Reservación recibida</p>
        <p className="booking__folio">{enviado}</p>
        <p>Guarda este folio. Te esperamos con tu estación lista a la hora que elegiste.</p>
        <button className="btn btn-ghost" onClick={() => setEnviado(null)}>Hacer otra reservación</button>
      </div>
    )
  }

  return (
    <form className="booking__form" onSubmit={onSubmit}>
      <label>
        Nombre
        <input name="cliente" required placeholder="¿A nombre de quién?" />
      </label>
      <label>
        Estación
        <select name="estacion" required defaultValue="">
          <option value="" disabled>Elige una</option>
          {libres.map((e) => (
            <option key={e.id} value={e.id}>{e.id} — {e.tipo}</option>
          ))}
        </select>
      </label>
      <div className="booking__row">
        <label>
          Fecha
          <input type="date" name="fecha" required />
        </label>
        <label>
          Hora
          <input type="time" name="hora" required />
        </label>
      </div>
      <label>
        Duración
        <select name="duracion" defaultValue="1">
          <option value="1">1 hora</option>
          <option value="2">2 horas</option>
          <option value="3">3 horas</option>
        </select>
      </label>
      <button type="submit" className="btn btn-primary" disabled={cargando}>
        {cargando ? 'Enviando…' : 'Confirmar reservación'}
      </button>
      {!supabaseReady && (
        <p className="booking__hint">Modo de demostración: conecta Supabase para guardar reservaciones reales.</p>
      )}
    </form>
  )
}

function ConsultaFolio() {
  const [folio, setFolio] = useState('')
  const [resultado, setResultado] = useState(undefined)

  function buscar(e) {
    e.preventDefault()
    const encontrada = RESERVACIONES.find((r) => r.folio.toLowerCase() === folio.trim().toLowerCase())
    setResultado(encontrada || null)
  }

  return (
    <div>
      <form className="booking__lookup" onSubmit={buscar}>
        <input
          value={folio}
          onChange={(e) => setFolio(e.target.value)}
          placeholder="Tu folio, ej. CL-3081"
        />
        <button type="submit" className="btn btn-primary">Buscar</button>
      </form>

      {resultado === null && <p className="booking__hint">No encontramos ese folio. Revisa que esté completo.</p>}

      {resultado && (
        <div className="booking__result">
          <p className="booking__folio">{resultado.folio}</p>
          <dl>
            <div><dt>Cliente</dt><dd>{resultado.cliente}</dd></div>
            <div><dt>Estación</dt><dd>{resultado.estacion}</dd></div>
            <div><dt>Fecha</dt><dd>{resultado.fecha} · {resultado.hora}</dd></div>
            <div><dt>Estado</dt><dd className={`estado-pill estado-pill--${resultado.estado}`}>{resultado.estado}</dd></div>
          </dl>
        </div>
      )}
    </div>
  )
}
