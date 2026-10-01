import { useEffect, useState } from 'react'
import { ESTACIONES } from '../data/mockData'
import { supabase, supabaseReady } from './supabaseClient'

export function minutosRestantes(finMs, ahora = Date.now()) {
  return Math.max(0, Math.ceil((finMs - ahora) / 60000))
}

// Datos de ejemplo cuando el sitio aún no tiene Supabase conectado.
function demo() {
  return ESTACIONES.map((e) => ({
    id: e.id, tipo: e.tipo, specs: e.specs, estado: e.estado,
    finMs: e.estado === 'sesion' ? Date.now() + e.restanteMin * 60000 : null,
  }))
}

// Estado en vivo de las estaciones para la página pública (se refresca solo cada 15 s).
export function useEstacionesPublicas() {
  const [filas, setFilas] = useState(() => (supabaseReady ? null : demo()))
  const [error, setError] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!supabaseReady) return
    let vivo = true
    async function cargar() {
      const { data, error } = await supabase
        .from('estaciones_publicas')
        .select('id, tipo, specs, estado, fin_sesion')
        .order('id')
      if (!vivo) return
      if (error) { setError(true); return }
      setError(false)
      setFilas(data.map((r) => ({
        id: r.id, tipo: r.tipo, specs: r.specs, estado: r.estado,
        finMs: r.fin_sesion ? new Date(r.fin_sesion).getTime() : null,
      })))
    }
    cargar()
    const poll = setInterval(cargar, 15000)
    const volver = () => document.visibilityState === 'visible' && cargar()
    document.addEventListener('visibilitychange', volver)
    return () => { vivo = false; clearInterval(poll); document.removeEventListener('visibilitychange', volver) }
  }, [])

  // Re-pinta cada 30 s para que la cuenta regresiva avance.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const estaciones = (filas ?? []).map((f) => ({
    ...f,
    restanteMin: f.estado === 'sesion' && f.finMs ? minutosRestantes(f.finMs) : undefined,
  }))
  return { estaciones, cargando: filas === null && !error, error: error && filas === null }
}
