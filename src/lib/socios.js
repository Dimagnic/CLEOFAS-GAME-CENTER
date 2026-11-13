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

// Igual que la base de datos: primero se redondea el descuento, luego se resta
export const conDescuento = (precio, pct) => Math.max(0, precio - Math.round((precio * (pct || 0)) / 100))
export const pesos = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
export const fechaCorta = (iso) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

// Perfil del socio conectado (con su rango) + rangos + historial
export function useMiSocio() {
  const { session, loading: cargandoSesion } = useAuth()
  const uid = session?.user?.id
  const [estado, setEstado] = useState({ cargando: true, socio: null, rangos: [], movimientos: [], cupones: [], publicaciones: [], error: '' })

  const recargar = useCallback(async () => {
    if (!supabaseReady || !uid) { setEstado((e) => ({ ...e, cargando: false })); return }
    try {
      const [socio, rangos, movs, club] = await Promise.all([
        supabase.from('socios').select('*').eq('user_id', uid).maybeSingle(),
        cargarRangos(),
        supabase.from('movimientos').select('*').eq('socio_id', uid).order('created_at', { ascending: false }).limit(100),
        cargarClub(uid),
      ])
      if (socio.error) throw socio.error
      setEstado({ cargando: false, socio: socio.data, rangos, movimientos: movs.data ?? [], ...club, error: '' })
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

// ===================== Fase 2: cupones y novedades =====================

export const vigente = (c, ahora = Date.now()) => c.estado === 'disponible' && (!c.vence_at || new Date(c.vence_at).getTime() > ahora)
export function estadoCupon(c) {
  if (c.estado === 'disponible' && !vigente(c)) return 'vencido'
  return c.estado
}

// ¿Cuánto descuenta este cupón sobre un subtotal? contexto: 'horas' (sesiones) o 'snacks' (tienda)
export function descuentoCupon(c, subtotal, contexto) {
  if (!c || subtotal <= 0) return 0
  if (c.aplica !== 'todo' && c.aplica !== contexto) return 0
  const d = c.tipo === 'porcentaje' ? Math.round((subtotal * Number(c.valor)) / 100) : Number(c.valor)
  return Math.max(0, Math.min(subtotal, d))
}

const APLICA = { horas: 'en horas', snacks: 'en snacks y bebidas', todo: 'en lo que quieras' }
export const textoCupon = (c) => `${c.tipo === 'porcentaje' ? `${Number(c.valor)}%` : `$${Number(c.valor)}`} ${APLICA[c.aplica] ?? ''}`
export const fechaDia = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' })

export async function cuponesDisponibles(socioId, contexto) {
  const { data, error } = await supabase.from('cupones').select('*').eq('socio_id', socioId).eq('estado', 'disponible').order('vence_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data.filter((c) => vigente(c) && (c.aplica === 'todo' || c.aplica === contexto))
}

// Marca el cupón como usado en la base de datos (falla si ya se usó o venció).
export async function canjearCupon(cupon, usadoEn, descuento) {
  const { error } = await supabase.rpc('canjear_cupon', { p_cupon: cupon.id, p_usado_en: usadoEn, p_descuento: descuento })
  if (error) throw new Error(error.message.includes('cupón') ? error.message : `No se pudo canjear el cupón: ${error.message}`)
}

export const TIPOS_PUB = {
  promocion: { etiqueta: 'Promoción', color: '#FF2A2A' },
  evento: { etiqueta: 'Evento', color: '#B46BFF' },
  noticia: { etiqueta: 'Noticia', color: '#2EC4FF' },
  comunicado: { etiqueta: 'Comunicado', color: '#FFB238' },
}

// Cupones y publicaciones del socio conectado (la base de datos filtra por rango y vigencia)
export async function cargarClub(uid) {
  const [cup, pub] = await Promise.all([
    supabase.from('cupones').select('*').eq('socio_id', uid).order('created_at', { ascending: false }).limit(100),
    supabase.from('publicaciones').select('*, rangos(nombre, color)').order('destacado', { ascending: false }).order('created_at', { ascending: false }).limit(40),
  ])
  // Si la Fase 2 aún no está instalada en la base, simplemente no se muestran.
  return { cupones: cup.error ? [] : cup.data, publicaciones: pub.error ? [] : pub.data }
}

// ===================== Fase 3: automatización =====================

// Campañas de puntos activas HOY (hora de Puebla) para mostrar "puntos x2" al socio
export async function campanasDeHoy() {
  const { data, error } = await supabase.from('campanas').select('*').eq('activo', true)
  if (error) return []
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date())
  const g = (t) => p.find((x) => x.type === t)?.value
  const hoy = `${g('year')}-${g('month')}-${g('day')}`
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'))
  return data.filter((c) => (!c.desde || c.desde <= hoy) && (!c.hasta || c.hasta >= hoy) && (!c.dias_semana?.length || c.dias_semana.includes(dow)))
}

export const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Llama a una función del servidor (/api/...) con la sesión del equipo
export async function apiEquipo(ruta, cuerpo) {
  const { data } = await supabase.auth.getSession()
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(cuerpo ?? {}),
  })
  let datos = null
  try { datos = await r.json() } catch { /* sin JSON */ }
  if (!r.ok) throw new Error(datos?.error || (r.status === 404 ? 'La función no existe aquí (usa el sitio publicado o "npx vercel dev").' : 'No se pudo conectar con el servidor.'))
  return datos
}
