import { useEffect, useState } from 'react'
import { RESERVACIONES } from '../../data/mockData'
import { supabase, supabaseReady } from '../../lib/supabaseClient'

const ETIQUETAS = {
  confirmada: 'pagada',
  pendiente: 'pendiente',
  pendiente_pago: 'esperando pago',
  cancelada: 'cancelada',
  expirada: 'expirada',
}

export default function Reservations() {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')

  async function cargar() {
    if (!supabaseReady) {
      setFilas(RESERVACIONES.map((r) => ({ ...r, duracion_h: r.duracionH })))
      return
    }
    const { data, error } = await supabase
      .from('reservaciones')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(200)
    if (error) setError(error.message)
    else setFilas(data)
  }

  useEffect(() => { cargar() }, [])

  async function cancelar(r) {
    const aviso = r.estado === 'confirmada'
      ? `Esto libera el horario pero NO reembolsa a ${r.cliente}: el reembolso se hace desde tu panel de Stripe. ¿Cancelar ${r.folio}?`
      : `¿Cancelar la reservación ${r.folio}?`
    if (!window.confirm(aviso)) return
    const { error } = await supabase.from('reservaciones').update({ estado: 'cancelada' }).eq('id', r.id)
    if (error) setError(error.message)
    else cargar()
  }

  const pagadasHoy = (filas ?? []).filter((r) => r.estado === 'confirmada')
  const totalPagado = pagadasHoy.reduce((s, r) => s + Number(r.monto || 0), 0)

  return (
    <div>
      <header className="admin-page__head">
        <h1>Reservaciones</h1>
        <p>Lo que la gente aparta y paga desde la página, en un solo lugar.</p>
      </header>

      {supabaseReady && (
        <div className="admin-cards">
          <div className="admin-card">
            <p className="admin-card__label">Reservas pagadas (últimas 200)</p>
            <p className="admin-card__value">{pagadasHoy.length}</p>
          </div>
          <div className="admin-card">
            <p className="admin-card__label">Cobrado en línea</p>
            <p className="admin-card__value">${totalPagado}</p>
          </div>
        </div>
      )}

      {error && <p className="admin-note">Error: {error}</p>}
      {!filas && !error && <p className="admin-note">Cargando…</p>}

      {filas && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Folio</th><th>Cliente</th><th>Contacto</th><th>Estación</th><th>Cuándo</th>
              <th>Duración</th><th>Monto</th><th>Estado</th>{supabaseReady && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.folio}>
                <td className="mono">{r.folio}</td>
                <td>{r.cliente}</td>
                <td>{r.email || '—'}{r.telefono ? <><br />{r.telefono}</> : null}</td>
                <td>{r.estacion}</td>
                <td>{r.fecha} · {String(r.hora).slice(0, 5)}</td>
                <td>{r.duracion_h} h</td>
                <td>{r.monto ? `$${r.monto}` : '—'}</td>
                <td><span className={`estado-pill estado-pill--${r.estado}`}>{ETIQUETAS[r.estado] ?? r.estado}</span></td>
                {supabaseReady && (
                  <td>
                    {['confirmada', 'pendiente', 'pendiente_pago'].includes(r.estado) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => cancelar(r)}>Cancelar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!supabaseReady && (
        <p className="admin-note">
          Modo demo. Conecta Supabase (ver <code>supabase/schema.sql</code> y <code>supabase/migration-pagos.sql</code>)
          para ver aquí las reservas reales.
        </p>
      )}
    </div>
  )
}
