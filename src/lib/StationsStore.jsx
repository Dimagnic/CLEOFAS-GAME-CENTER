import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ESTACIONES, TARIFAS } from '../data/mockData'
import { supabase, supabaseReady } from './supabaseClient'

const StationsContext = createContext(null)

export function StationsProvider({ children }) {
  const [estaciones, setEstaciones] = useState(ESTACIONES)
  const [cierresHoy, setCierresHoy] = useState([])
  const tickRef = useRef()

  // Cuenta regresiva: baja un minuto cada minuto para las estaciones en sesión.
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setEstaciones((prev) =>
        prev.map((e) =>
          e.estado === 'sesion' && e.restanteMin > 0
            ? { ...e, restanteMin: e.restanteMin - 1 }
            : e
        )
      )
    }, 60000)
    return () => clearInterval(tickRef.current)
  }, [])

  function iniciarSesion(id, { cliente, tarifaId }) {
    const tarifa = TARIFAS.find((t) => t.id === tarifaId)
    const minutos = tarifa?.id === 'hora' ? 60 : tarifa?.id === 'paq3' ? 180 : tarifa?.id === 'paq5' ? 300 : 60
    setEstaciones((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, estado: 'sesion', cliente, restanteMin: minutos, tarifaId, precio: tarifa?.precio }
          : e
      )
    )
  }

  async function finalizarSesion(id) {
    const est = estaciones.find((e) => e.id === id)
    if (est) {
      const cierre = {
        estacion: id,
        cliente: est.cliente,
        precio: est.precio ?? 0,
        hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      }
      setCierresHoy((prev) => [cierre, ...prev])
      if (supabaseReady) {
        const { error } = await supabase.from('cierres').insert(cierre)
        if (error) console.error(error)
      }
    }
    setEstaciones((prev) =>
      prev.map((e) => (e.id === id ? { ...e, estado: 'libre', cliente: undefined, restanteMin: undefined } : e))
    )
  }

  function marcarMantenimiento(id) {
    setEstaciones((prev) => prev.map((e) => (e.id === id ? { ...e, estado: 'mantenimiento' } : e)))
  }

  function liberar(id) {
    setEstaciones((prev) => prev.map((e) => (e.id === id ? { ...e, estado: 'libre' } : e)))
  }

  return (
    <StationsContext.Provider
      value={{ estaciones, cierresHoy, iniciarSesion, finalizarSesion, marcarMantenimiento, liberar }}
    >
      {children}
    </StationsContext.Provider>
  )
}

export function useStations() {
  return useContext(StationsContext)
}
