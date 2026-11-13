import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ESTACIONES, TARIFAS } from '../data/mockData'
import { supabase, supabaseReady } from './supabaseClient'
import { useAuth } from './AuthContext'
import { minutosRestantes } from './estacionesPublicas'
import { conDescuento } from './socios'

const StationsContext = createContext(null)

const MINUTOS = { hora: 60, paq3: 180, paq5: 300 }
// Solo estas tarifas se cobran en mostrador por sesión. El pase mensual no es una sesión.
export const TARIFAS_SESION = TARIFAS.filter((t) => MINUTOS[t.id])
export const TARIFA_RESERVA = 'reserva' // sesión de una reserva ya pagada en línea

const aFila = (r) => ({
  id: r.id, tipo: r.tipo, specs: r.specs, estado: r.estado,
  cliente: r.cliente ?? undefined, tarifaId: r.tarifa_id ?? undefined, precio: r.precio ?? undefined,
  socioId: r.socio_id ?? null, descuento: Number(r.descuento || 0),
  finMs: r.fin_sesion ? new Date(r.fin_sesion).getTime() : null,
})

function inicioDeHoyMX() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  return new Date(`${f}T00:00:00-06:00`).toISOString()
}

export function StationsProvider({ children }) {
  const { session, esEquipo } = useAuth()
  const enLinea = supabaseReady && Boolean(session && !session.demo && esEquipo)

  const [filas, setFilas] = useState(() =>
    ESTACIONES.map((e) => ({ ...e, finMs: e.estado === 'sesion' ? Date.now() + e.restanteMin * 60000 : null }))
  )
  const [cierresHoy, setCierresHoy] = useState([])
  const [reservas, setReservas] = useState([]) // reservas en línea de los próximos 7 días
  const [, setTick] = useState(0)
  const [errorSync, setErrorSync] = useState('')

  const cargar = useCallback(async () => {
    if (!enLinea) return
    const ahora = Date.now()
    const [est, cie, res] = await Promise.all([
      supabase.from('estaciones').select('*').order('id'),
      supabase.from('cierres').select('*').gte('created_at', inicioDeHoyMX()).order('created_at', { ascending: false }),
      supabase.from('reservaciones')
        .select('folio, estacion, cliente, inicio, fin, estado, expires_at')
        .in('estado', ['confirmada', 'pendiente_pago'])
        .not('inicio', 'is', null)
        .gte('fin', new Date(ahora).toISOString())
        .lte('inicio', new Date(ahora + 7 * 24 * 3600000).toISOString())
        .order('inicio')
        .limit(50),
    ])
    if (est.error) { setErrorSync(est.error.message); return }
    setErrorSync('')
    setFilas(est.data.map(aFila))
    if (!cie.error) {
      setCierresHoy(cie.data.map((c) => ({
        estacion: c.estacion, cliente: c.cliente, precio: Number(c.precio), hora: c.hora,
        tipo: c.tipo ?? 'sesion', detalle: c.detalle ?? '', socioId: c.socio_id ?? null, descuento: Number(c.descuento || 0),
      })))
    }
    if (!res.error) {
      setReservas(res.data
        // un pago pendiente que ya venció no bloquea nada
        .filter((r) => r.estado !== 'pendiente_pago' || !r.expires_at || new Date(r.expires_at).getTime() > ahora)
        .map((r) => ({
          folio: r.folio, estacion: r.estacion, cliente: r.cliente, estado: r.estado,
          iniMs: new Date(r.inicio).getTime(), finMs: new Date(r.fin).getTime(),
        })))
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

  // Reservas en línea de una estación que aún no terminan (la que está en curso o la próxima, en orden).
  function reservasDe(estacionId) {
    const ahora = Date.now()
    return reservas.filter((r) => r.estacion === estacionId && r.finMs > ahora).sort((a, b) => a.iniMs - b.iniMs)
  }

  async function guardar(id, cambios) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios.local } : f)))
    if (!enLinea) return
    const { error } = await supabase
      .from('estaciones')
      .update({ ...cambios.db, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { setErrorSync(error.message); cargar() }
  }

  // socio (opcional): se aplica su descuento en horas y la sesión le suma puntos al cerrarla.
  function iniciarSesion(id, { cliente, tarifaId, socio, descuentoCupon = 0 }) {
    const tarifa = TARIFAS_SESION.find((t) => t.id === tarifaId)
    if (!tarifa) { setErrorSync('Esa tarifa no se puede usar para una sesión.'); return Promise.resolve() }
    const finMs = Date.now() + MINUTOS[tarifaId] * 60000
    const precio = Math.max(0, conDescuento(tarifa.precio, socio?.rangos?.desc_horas) - descuentoCupon)
    const descuento = tarifa.precio - precio
    const nombre = cliente || socio?.nombre || 'Cliente'
    return guardar(id, {
      local: { estado: 'sesion', cliente: nombre, tarifaId, precio, finMs, socioId: socio?.user_id ?? null, descuento },
      db: {
        estado: 'sesion', cliente: nombre, tarifa_id: tarifaId, precio, fin_sesion: new Date(finMs).toISOString(),
        ...(socio ? { socio_id: socio.user_id, descuento } : {}),
      },
    })
  }

  // El cliente de una reserva en línea llegó: su sesión ya está pagada ($0 en caja) y termina a la hora reservada.
  function iniciarReserva(id, reserva) {
    const cliente = `${reserva.cliente} · ${reserva.folio}`
    const finMs = reserva.finMs
    return guardar(id, {
      local: { estado: 'sesion', cliente, tarifaId: TARIFA_RESERVA, precio: 0, finMs, socioId: null, descuento: 0 },
      db: { estado: 'sesion', cliente, tarifa_id: TARIFA_RESERVA, precio: 0, fin_sesion: new Date(finMs).toISOString() },
    })
  }

  async function finalizarSesion(id) {
    const est = filas.find((e) => e.id === id)
    if (est) {
      const cierre = {
        estacion: id,
        cliente: est.tarifaId === TARIFA_RESERVA ? `${est.cliente} (pagado en línea)` : est.cliente,
        precio: est.tarifaId === TARIFA_RESERVA ? 0 : est.precio ?? 0,
        // Los puntos del socio los suma la base de datos al guardar este cierre.
        ...(est.socioId ? { socio_id: est.socioId, tipo: 'sesion', descuento: est.descuento || 0 } : {}),
        hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }),
      }
      setCierresHoy((prev) => [cierre, ...prev])
      if (enLinea) {
        const { error } = await supabase.from('cierres').insert(cierre)
        if (error) setErrorSync(error.message)
      }
    }
    return guardar(id, {
      local: { estado: 'libre', cliente: undefined, tarifaId: undefined, precio: undefined, finMs: null, socioId: null, descuento: 0 },
      db: { estado: 'libre', cliente: null, tarifa_id: null, precio: null, fin_sesion: null, ...(est?.socioId ? { socio_id: null, descuento: 0 } : {}) },
    })
  }

  // Venta de la tienda (snacks y bebidas). Va a la caja del día y, si hay socio, le suma puntos.
  async function registrarVenta({ detalle, total, descuento, socio, cliente }) {
    const cierre = {
      estacion: 'TIENDA',
      cliente: socio?.nombre || cliente || 'Mostrador',
      precio: total,
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }),
      tipo: 'snack',
      detalle,
      descuento,
      socio_id: socio?.user_id ?? null,
    }
    if (enLinea) {
      const { error } = await supabase.from('cierres').insert(cierre)
      if (error) throw error
    }
    setCierresHoy((prev) => [{ ...cierre, socioId: cierre.socio_id }, ...prev])
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
      value={{ estaciones, cierresHoy, errorSync, enLinea, reservas, reservasDe, iniciarSesion, iniciarReserva, finalizarSesion, registrarVenta, marcarMantenimiento, liberar }}
    >
      {children}
    </StationsContext.Provider>
  )
}

export function useStations() {
  return useContext(StationsContext)
}
