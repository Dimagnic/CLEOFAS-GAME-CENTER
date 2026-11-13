import { useState } from 'react'
import { useStations, TARIFAS_SESION, TARIFA_RESERVA } from '../../lib/StationsStore'
import { conDescuento, descuentoCupon, canjearCupon } from '../../lib/socios'
import SocioPicker from './SocioPicker'
import CuponSelector from './CuponSelector'

const MIN_TARIFA = { hora: 60, paq3: 180, paq5: 300 }
const LLEGADA_ANTES_MIN = 60 // se puede registrar la llegada hasta 1 h antes de la reserva
const hora = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

export default function StationsControl() {
  const { estaciones, errorSync, reservasDe, iniciarSesion, iniciarReserva, finalizarSesion, marcarMantenimiento, liberar } = useStations()
  const [abriendo, setAbriendo] = useState(null)

  return (
    <div>
      <header className="admin-page__head">
        <h1>Control de estaciones</h1>
        <p>Inicia y cierra sesiones sin cronómetro ni cuaderno: el tiempo corre solo.</p>
      </header>

      {errorSync && (
        <p className="admin-note">
          No se pudo sincronizar con la base de datos ({errorSync}). Revisa que ejecutaste <code>supabase/migration-estaciones.sql</code>.
        </p>
      )}

      <div className="admin-stations">
        {estaciones.map((e) => (
          <div key={e.id} className={`admin-station admin-station--${e.estado}`}>
            <div className="admin-station__top">
              <strong>{e.id}</strong>
              <span>{e.tipo}</span>
            </div>

            {e.estado === 'libre' && (
              <button className="btn btn-primary btn-sm" onClick={() => setAbriendo(e.id)}>
                Iniciar sesión
              </button>
            )}

            {e.estado === 'sesion' && (
              <div className="admin-station__session">
                <p className="admin-station__cliente">{e.cliente}</p>
                <p className="admin-station__timer">{e.restanteMin} min restantes</p>
                {e.tarifaId === TARIFA_RESERVA && <p className="admin-station__reserva">Pagada en línea · no cobrar</p>}
                {e.tarifaId !== TARIFA_RESERVA && e.precio != null && (
                  <p className="admin-station__cobro">Cobrar ${e.precio}{e.socioId ? ` · socio${e.descuento ? ` (−$${e.descuento})` : ''}` : ''}</p>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => finalizarSesion(e.id)}>
                  {e.tarifaId === TARIFA_RESERVA ? 'Cerrar sesión' : 'Cerrar y cobrar'}
                </button>
              </div>
            )}

            {e.estado === 'mantenimiento' && (
              <div className="admin-station__session">
                <p className="admin-station__cliente">Fuera de servicio</p>
                <button className="btn btn-ghost btn-sm" onClick={() => liberar(e.id)}>
                  Marcar como libre
                </button>
              </div>
            )}

            {reservasDe(e.id)[0] && (
              <p className="admin-station__reserva">
                Reserva en línea: {hora(reservasDe(e.id)[0].iniMs)}–{hora(reservasDe(e.id)[0].finMs)} · {reservasDe(e.id)[0].cliente.split(' ')[0]}
              </p>
            )}

            {e.estado === 'libre' && (
              <button className="admin-station__maint" onClick={() => marcarMantenimiento(e.id)}>
                Enviar a mantenimiento
              </button>
            )}
          </div>
        ))}
      </div>

      {abriendo && (
        <IniciarSesionModal
          estacionId={abriendo}
          reserva={reservasDe(abriendo)[0]}
          onClose={() => setAbriendo(null)}
          onConfirm={async (datos) => {
            // El cupón se canjea primero: si ya se usó o venció, la sesión no se inicia con descuento.
            if (datos.cupon) await canjearCupon(datos.cupon, `Sesión ${abriendo}`, datos.descuentoCupon)
            await iniciarSesion(abriendo, datos)
            setAbriendo(null)
          }}
          onLlegada={(reserva) => {
            iniciarReserva(abriendo, reserva)
            setAbriendo(null)
          }}
        />
      )}
    </div>
  )
}

function IniciarSesionModal({ estacionId, reserva, onClose, onConfirm, onLlegada }) {
  const [tarifaId, setTarifaId] = useState(TARIFAS_SESION[0].id)
  const [socio, setSocio] = useState(null)
  const [cupon, setCupon] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [errorCupon, setErrorCupon] = useState('')
  const pct = socio?.rangos?.desc_horas || 0
  const tarifa = TARIFAS_SESION.find((t) => t.id === tarifaId)
  const conRango = conDescuento(tarifa.precio, pct)
  const dCupon = descuentoCupon(cupon, conRango, 'horas')
  const aCobrar = conRango - dCupon

  // ¿Hay una reserva en línea que se empalme con la sesión que estás por iniciar?
  const ahora = Date.now()
  const enCurso = reserva && reserva.iniMs <= ahora
  const minutosLibres = reserva && !enCurso ? Math.floor((reserva.iniMs - ahora) / 60000) : null
  const choca = (id) => reserva && (enCurso || ahora + (MIN_TARIFA[id] ?? 60) * 60000 > reserva.iniMs)
  const nombreReserva = reserva?.cliente.split(' ')[0]
  // Solo reservas pagadas, en curso o que empiezan pronto, pueden registrarse como "llegó".
  const puedeLlegar = reserva?.estado === 'confirmada' && reserva.iniMs - ahora <= LLEGADA_ANTES_MIN * 60000

  async function onSubmit(e) {
    e.preventDefault()
    const form = new FormData(e.target)
    if (choca(tarifaId)) {
      const aviso = enCurso
        ? `${estacionId} tiene una reserva en línea de ${nombreReserva} en curso hasta las ${hora(reserva.finMs)}. ¿Iniciar la sesión de todos modos?`
        : `Esta sesión terminaría después de las ${hora(reserva.iniMs)}, cuando empieza la reserva en línea de ${nombreReserva}. ¿Iniciar de todos modos?`
      if (!window.confirm(aviso)) return
    }
    setEnviando(true); setErrorCupon('')
    try {
      await onConfirm({ cliente: String(form.get('cliente') || '').trim(), tarifaId, socio, cupon, descuentoCupon: dCupon })
    } catch (err) {
      setErrorCupon(err.message); setCupon(null); setEnviando(false)
    }
  }

  return (
    <div className="admin-modal__backdrop" onClick={onClose}>
      <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3>Iniciar sesión en {estacionId}</h3>
        {reserva && (
          <p className="admin-modal__aviso">
            {enCurso
              ? `Esta estación tiene una reserva en línea en curso: ${nombreReserva}, de ${hora(reserva.iniMs)} a ${hora(reserva.finMs)}.`
              : `Reserva en línea de ${nombreReserva} a las ${hora(reserva.iniMs)} (en ${minutosLibres} min). Hasta entonces la estación está libre ${minutosLibres} min.`}
          </p>
        )}
        {puedeLlegar && (
          <div className="admin-modal__llegada">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLlegada(reserva)}>
              Llegó {nombreReserva} · {reserva.folio}
            </button>
            <p>Ya pagó en línea: la sesión no se cobra y termina a las {hora(reserva.finMs)}.</p>
          </div>
        )}
        <p className="admin-modal__sub">{puedeLlegar ? 'O inicia una sesión normal en mostrador:' : null}</p>
        <div className="admin-modal__campo">
          <span>Socio del club (opcional)</span>
          <SocioPicker value={socio} onChange={setSocio} />
        </div>
        <label>
          Cliente
          <input name="cliente" required={!socio} placeholder={socio ? socio.nombre : 'Nombre'} key={socio?.user_id ?? 'sin-socio'} />
        </label>
        <label>
          Tarifa
          <select name="tarifa" value={tarifaId} onChange={(e) => setTarifaId(e.target.value)}>
            {TARIFAS_SESION.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} — ${conDescuento(t.precio, pct)}{pct ? ` (antes $${t.precio})` : ''}{choca(t.id) ? ' · se empalma con la reserva' : ''}
              </option>
            ))}
          </select>
        </label>
        <CuponSelector socio={socio} contexto="horas" subtotal={conRango} value={cupon} onChange={setCupon} />
        {errorCupon && <p className="admin-modal__aviso">{errorCupon}</p>}
        {(socio || cupon) && (
          <p className="admin-modal__total">
            <span>A cobrar{tarifa.precio !== aCobrar ? ` (antes $${tarifa.precio})` : ''}</span>
            <b>${aCobrar}</b>
          </p>
        )}
        <div className="admin-modal__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>{enviando ? 'Iniciando…' : 'Iniciar'}</button>
        </div>
      </form>
    </div>
  )
}
