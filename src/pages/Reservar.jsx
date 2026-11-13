import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CuentaMarco from './cuenta/CuentaMarco'
import { FormReserva, Retorno, ConsultaFolio } from '../components/Booking'
import { useAuth } from '../lib/AuthContext'
import { NEGOCIO } from '../data/negocio'

// Página independiente para reservar (sin pasar por la página principal)
export default function Reservar() {
  const { session } = useAuth()
  const [tab, setTab] = useState('reservar')
  const [retorno, setRetorno] = useState(null)

  // Al volver de Stripe: /reservar?pago=ok|cancelado&folio=CL-XXXXX
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('pago') && q.get('folio')) {
      setRetorno({ pago: q.get('pago'), folio: q.get('folio') })
      window.history.replaceState({}, '', '/reservar')
    }
  }, [])

  return (
    <CuentaMarco ancho>
      <div className="reservar">
        <section className="reservar__info">
          <p className="eyebrow">Reserva en línea</p>
          <h1>Aparta tu estación</h1>
          <p className="cuenta-muted">Elige equipo, día y hora. Agrega tus snacks y bebidas para que estén listos al llegar, y paga todo en línea o al llegar.</p>
          <ol className="reservar__pasos">
            <li><b>1</b><span>Elige estación, fecha, duración y hora.</span></li>
            <li><b>2</b><span>Agrega productos de la tienda (opcional).</span></li>
            <li><b>3</b><span>Paga en línea o elige pagar tus productos al llegar.</span></li>
            <li><b>4</b><span>Recibe tu folio y muéstralo en mostrador.</span></li>
          </ol>
          {!session && (
            <div className="reservar__socio">
              <strong>¿Eres socio del Club?</strong>
              <span>Inicia sesión para usar tu descuento, tus cupones y sumar puntos.</span>
              <Link to="/cuenta/entrar" className="btn btn-ghost btn-sm">Iniciar sesión</Link>
            </div>
          )}
          <p className="cuenta-nota">Horario: {NEGOCIO.horarioLineas.join(' · ')}</p>
        </section>

        <section className="reservar__card booking__card">
          <div className="booking__tabs reservar__tabs">
            <button className={tab === 'reservar' ? 'is-active' : ''} onClick={() => { setTab('reservar'); setRetorno(null) }}>Reservar</button>
            <button className={tab === 'consultar' ? 'is-active' : ''} onClick={() => { setTab('consultar'); setRetorno(null) }}>Consultar folio</button>
          </div>
          {retorno ? <Retorno retorno={retorno} onCerrar={() => setRetorno(null)} /> : tab === 'reservar' ? <FormReserva volver="/reservar" /> : <ConsultaFolio />}
        </section>
      </div>
    </CuentaMarco>
  )
}
