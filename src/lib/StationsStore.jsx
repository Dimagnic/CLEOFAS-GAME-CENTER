import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ESTACIONES, TARIFAS } from '../data/mockData'
import { supabase, supabaseReady } from './supabaseClient'
import { useAuth } from './AuthContext'
import { minutosRestantes } from './estacionesPublicas'

const StationsContext = createContext(null)

const MINUTOS = { hora: 60, paq3: 180, paq5: 300 }

const aFila = (r) => ({
  id: r.id, tipo: r.tipo, specs: r.specs, estado: r.estado,
  cliente: r.cliente ?? undefined, tarifaId: r.tarifa_id ?? undefined, precio: r.precio ?? undefined,
  finMs: r.fin_sesion ? new Date(r.fin_sesion).getTime() : null,
})

function inicioDeHoyMX() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  return new Date(`${f}T00:00:00-06:00`).toISOString()
}

export function StationsProvider({ children }) {
  const { session } = useAuth()
  const enLinea = supabaseReady && Boolean(session && !session.demo)

  const [filas, setFilas] = useState(() =>
    ESTACIONES.map((e) => ({ ...e, finMs: e.estado === 'sesion' ? Date.now() + e.restanteMin * 60000 : null }))
  )
  const [cierresHoy, setCierresHoy] = useState([])
  const [, setTick] = useState(0)
  const [errorSync, setErrorSync] = useState('')

  const cargar = useCallback(async () => {
    if (!enLinea) return
    const [est, cie] = await Promise.all([
      supabase.from('estaciones').select('*').order('id'),
      supabase.from('cierres').select('*').gte('created_at', inicioDeHoyMX()).order('created_at', { ascending: false }),
    ])
    if (est.error) { setErrorSync(est.error.message); return }
    setErrorSync('')
    setFilas(est.data.map(aFila))
    if (!cie.error) {
      setCierresHoy(cie.data.map((c) => ({ estacion: c.estacion, cliente: c.cliente, precio: Number(c.precio), hora: c.hora })))
    }
  }, [enLinea])

  // Con Supabase: carga al entrar, refresca cada 20 s y al volver a la pestaña.
  useEffect(() => {
    if (!enLinea) return
    cargar()
    const poll = setInterval(cargar, 20000)
    const volver = () => document.visibilityState === 'visible' && cargar()
    document.addEventListener('visibilitychange', volver)
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', volver) }
  }, [enLinea, cargar])

  // Re-pinta cada 30 s para que baje la cuenta regresiva.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const estaciones = filas.map((f) => ({
    ...f,
    restanteMin: f.estado === 'sesion' && f.finMs ? minutosRestantes(f.finMs) : undefined,
  }))

  async function guardar(id, cambios) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios.local } : f)))
    if (!enLinea) return
    const { error } = await supabase
      .from('estaciones')
      .update({ ...cambios.db, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { setErrorSync(error.message); cargar() }
  }

  function iniciarSesion(id, { cliente, tarifaId }) {
    const tarifa = TARIFAS.find((t) => t.id === tarifaId)
    const finMs = Date.now() + (MINUTOS[tarifaId] ?? 60) * 60000
    return guardar(id, {
      local: { estado: 'sesion', cliente, tarifaId, precio: tarifa?.precio, finMs },
      db: { estado: 'sesion', cliente, tarifa_id: tarifaId, precio: tarifa?.precio ?? 0, fin_sesion: new Date(finMs).toISOString() },
    })
  }

  async function finalizarSesion(id) {
    const est = filas.find((e) => e.id === id)
    if (est) {
      const cierre = {
        estacion: id,
        cliente: est.cliente,
        precio: est.precio ?? 0,
        hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }),
      }
      setCierresHoy((prev) => [cierre, ...prev])
      if (enLinea) {
        const { error } = await supabase.from('cierres').insert(cierre)
        if (error) setErrorSync(error.message)
      }
    }
    return guardar(id, {
      local: { estado: 'libre', cliente: undefined, tarifaId: undefined, precio: undefined, finMs: null },
      db: { estado: 'libre', cliente: null, tarifa_id: null, precio: null, fin_sesion: null },
    })
  }

  function marcarMantenimiento(id) {
    return guardar(id, {
      local: { estado: 'mantenimiento' },
      db: { estado: 'mantenimiento', cliente: null, tarifa_id: null, precio: null, fin_sesion: null },
    })
  }

  function liberar(id) {
    return guardar(id, {
      local: { estado: 'libre' },
      db: { estado: 'libre' },
    })
  }

  return (
    <StationsContext.Provider
      value={{ estaciones, cierresHoy, errorSync, iniciarSesion, finalizarSesion, marcarMantenimiento, liberar }}
    >
      {children}
    </StationsContext.Provider>
  )
}

export function useStations() {
  return useContext(StationsContext)
}
