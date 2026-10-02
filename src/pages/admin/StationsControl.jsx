import { useState } from 'react'
import { useStations } from '../../lib/StationsStore'
import { TARIFAS } from '../../data/mockData'

const MIN_TARIFA = { hora: 60, paq3: 180, paq5: 300 }
const hora = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

export default function StationsControl() {
  const { estaciones, errorSync, reservasDe, iniciarSesion, finalizarSesion, marcarMantenimiento, liberar } = useStations()
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
                <button className="btn btn-ghost btn-sm" onClick={() => finalizarSesion(e.id)}>
                  Cerrar y cobrar
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
          onConfirm={(datos) => {
            iniciarSesion(abriendo, datos)
            setAbriendo(null)
          }}
        />
      )}
    </div>
  )
}

function IniciarSesionModal({ estacionId, reserva, onClose, onConfirm }) {
  const [tarifaId, setTarifaId] = useState(TARIFAS[0].id)

  // ¿Hay una reserva en línea que se empalme con la sesión que estás por iniciar?
  const ahora = Date.now()
  const enCurso = reserva && reserva.iniMs <= ahora
  const minutosLibres = reserva && !enCurso ? Math.floor((reserva.iniMs - ahora) / 60000) : null
  const choca = (id) => reserva && (enCurso || ahora + (MIN_TARIFA[id] ?? 60) * 60000 > reserva.iniMs)
  const nombreReserva = reserva?.cliente.split(' ')[0]

  function onSubmit(e) {
    e.preventDefault()
    const form = new FormData(e.target)
    if (choca(tarifaId)) {
      const aviso = enCurso
        ? `${estacionId} tiene una reserva en línea de ${nombreReserva} en curso hasta las ${hora(reserva.finMs)}. ¿Iniciar la sesión de todos modos?`
        : `Esta sesión terminaría después de las ${hora(reserva.iniMs)}, cuando empieza la reserva en línea de ${nombreReserva}. ¿Iniciar de todos modos?`
      if (!window.confirm(aviso)) return
    }
    onConfirm({ cliente: form.get('cliente'), tarifaId })
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
        <label>
          Cliente
          <input name="cliente" required placeholder="Nombre" />
        </label>
        <label>
          Tarifa
          <select name="tarifa" value={tarifaId} onChange={(e) => setTarifaId(e.target.value)}>
            {TARIFAS.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre} — ${t.precio}{choca(t.id) ? ' · se empalma con la reserva' : ''}</option>
            ))}
          </select>
        </label>
        <div className="admin-modal__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary btn-sm">Iniciar</button>
        </div>
      </form>
    </div>
  )
}
