import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabaseClient'
import { useAuth } from './AuthContext'

// Rangos ordenados de menor a mayor
export async function cargarRangos() {
  const { data, error } = await supabase.from('rangos').select('*').order('min_puntos')
  if (error) throw error
  return data
}

// Rango actual, siguiente y avance (0–1) para unos puntos dados
export function progreso(rangos, puntos, rangoId) {
  const actual = rangos.find((r) => r.id === rangoId) ?? [...rangos].reverse().find((r) => r.min_puntos <= puntos) ?? rangos[0]
  const siguiente = rangos.find((r) => r.min_puntos > Math.max(puntos, actual?.min_puntos ?? 0))
  if (!siguiente) return { actual, siguiente: null, faltan: 0, avance: 1 }
  const base = Math.min(actual?.min_puntos ?? 0, puntos)
  const avance = Math.min(1, Math.max(0, (puntos - base) / (siguiente.min_puntos - base || 1)))
  return { actual, siguiente, faltan: siguiente.min_puntos - puntos, avance }
}

export const conDescuento = (precio, pct) => Math.max(0, Math.round(precio - (precio * (pct || 0)) / 100))
export const pesos = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
export const fechaCorta = (iso) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

// Perfil del socio conectado (con su rango) + rangos + historial
export function useMiSocio() {
  const { session, loading: cargandoSesion } = useAuth()
  const uid = session?.user?.id
  const [estado, setEstado] = useState({ cargando: true, socio: null, rangos: [], movimientos: [], error: '' })

  const recargar = useCallback(async () => {
    if (!supabaseReady || !uid) { setEstado((e) => ({ ...e, cargando: false })); return }
    try {
      const [socio, rangos, movs] = await Promise.all([
        supabase.from('socios').select('*').eq('user_id', uid).maybeSingle(),
        cargarRangos(),
        supabase.from('movimientos').select('*').eq('socio_id', uid).order('created_at', { ascending: false }).limit(100),
      ])
      if (socio.error) throw socio.error
      setEstado({ cargando: false, socio: socio.data, rangos, movimientos: movs.data ?? [], error: '' })
    } catch (e) {
      setEstado((s) => ({ ...s, cargando: false, error: e.message }))
    }
  }, [uid])

  useEffect(() => { if (!cargandoSesion) recargar() }, [cargandoSesion, recargar])
  return { ...estado, cargando: estado.cargando || cargandoSesion, session, recargar }
}

// Búsqueda de socios para el panel (nombre, correo, teléfono o código del QR)
export async function buscarSocios(texto) {
  const q = texto.trim()
  if (q.length < 2) return []
  const codigo = q.toUpperCase().replace(/^CLEOFAS:/, '')
  let consulta = supabase.from('socios').select('user_id, nombre, email, telefono, codigo, puntos, rango_id, rangos(nombre, color, desc_horas, desc_snacks)')
  if (/^S-[A-Z0-9]{6}$/.test(codigo)) consulta = consulta.eq('codigo', codigo)
  else {
    const s = q.replace(/[%,()]/g, ' ')
    const tel = q.replace(/\D/g, '')
    const filtros = [`nombre.ilike.%${s}%`, `email.ilike.%${s}%`]
    if (tel.length >= 4) filtros.push(`telefono.ilike.%${tel}%`)
    consulta = consulta.or(filtros.join(','))
  }
  const { data, error } = await consulta.order('nombre').limit(8)
  if (error) throw error
  return data
}

export const ETIQUETA_MOV = { reserva: 'Reserva en línea', sesion: 'Sesión en mostrador', snack: 'Tienda', ajuste: 'Ajuste' }
