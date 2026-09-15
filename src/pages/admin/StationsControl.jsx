import { useState } from 'react'
import { useStations } from '../../lib/StationsStore'
import { TARIFAS } from '../../data/mockData'

export default function StationsControl() {
  const { estaciones, iniciarSesion, finalizarSesion, marcarMantenimiento, liberar } = useStations()
  const [abriendo, setAbriendo] = useState(null)

  return (
    <div>
      <header className="admin-page__head">
        <h1>Control de estaciones</h1>
        <p>Inicia y cierra sesiones sin cronómetro ni cuaderno: el tiempo corre solo.</p>
      </header>

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

function IniciarSesionModal({ estacionId, onClose, onConfirm }) {
  function onSubmit(e) {
    e.preventDefault()
    const form = new FormData(e.target)
    onConfirm({ cliente: form.get('cliente'), tarifaId: form.get('tarifa') })
  }

  return (
    <div className="admin-modal__backdrop" onClick={onClose}>
      <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3>Iniciar sesión en {estacionId}</h3>
        <label>
          Cliente
          <input name="cliente" required placeholder="Nombre" />
        </label>
        <label>
          Tarifa
          <select name="tarifa" defaultValue="hora">
            {TARIFAS.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre} — ${t.precio}</option>
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
