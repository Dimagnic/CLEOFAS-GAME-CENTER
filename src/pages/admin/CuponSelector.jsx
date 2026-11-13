import { useEffect, useState } from 'react'
import { cuponesDisponibles, descuentoCupon, textoCupon, fechaDia } from '../../lib/socios'

// Cupones vigentes del socio para aplicar en mostrador. contexto: 'horas' (sesiones) o 'snacks' (tienda)
export default function CuponSelector({ socio, contexto, subtotal, value, onChange }) {
  const [cupones, setCupones] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    onChange(null)
    if (!socio) { setCupones([]); return undefined }
    let vivo = true
    setCargando(true)
    cuponesDisponibles(socio.user_id, contexto)
      .then((c) => vivo && setCupones(c))
      .catch(() => vivo && setCupones([])) // si la Fase 2 no está instalada, no se muestra nada
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [socio?.user_id, contexto])

  if (!socio || (!cargando && cupones.length === 0)) return null
  return (
    <div className="admin-modal__campo">
      <span>Cupones del socio</span>
      {cargando ? <p className="socio-picker__nota">Buscando cupones…</p> : (
        <div className="cupon-selector">
          <label className={!value ? 'is-on' : ''}>
            <input type="radio" checked={!value} onChange={() => onChange(null)} />
            <span>No usar cupón</span>
          </label>
          {cupones.map((c) => {
            const d = descuentoCupon(c, subtotal, contexto)
            return (
              <label key={c.id} className={value?.id === c.id ? 'is-on' : ''}>
                <input type="radio" checked={value?.id === c.id} onChange={() => onChange(c)} />
                <span>
                  <strong>{c.titulo}</strong> · {textoCupon(c)}
                  <small>{c.codigo}{c.vence_at ? ` · vence ${fechaDia(c.vence_at)}` : ''}</small>
                </span>
                <b>−${d}</b>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
