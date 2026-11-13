import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabaseClient'

// Productos a la venta con existencias en tiempo real (cambian al vender en el POS o al apartar pedidos)
export function useCatalogo() {
  const [productos, setProductos] = useState(null)
  useEffect(() => {
    if (!supabaseReady) { setProductos([]); return undefined }
    let vivo = true
    const cargar = () => supabase.from('productos')
      .select('id, nombre, descripcion, precio, categoria, imagen_url, stock, apartado, stock_minimo, controla_stock')
      .eq('activo', true).order('categoria').order('orden').order('nombre')
      .then(({ data, error }) => {
        if (!vivo) return
        if (!error) return setProductos(data)
        // Base sin inventario todavía (antes de migration-pos.sql)
        supabase.from('productos').select('id, nombre, precio, categoria').eq('activo', true).order('categoria').order('nombre')
          .then(({ data: d }) => vivo && setProductos((d ?? []).map((p) => ({ ...p, controla_stock: false }))))
      })
    cargar()
    const canal = supabase.channel(`catalogo-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, cargar)
      .subscribe()
    const poll = setInterval(cargar, 45000) // respaldo si el tiempo real no está disponible
    return () => { vivo = false; supabase.removeChannel(canal); clearInterval(poll) }
  }, [])
  return productos
}

export const disponible = (p) => (p.controla_stock ? Math.max(0, p.stock - p.apartado) : 99)
export function etiquetaStock(p) {
  if (!p.controla_stock) return null
  const d = disponible(p)
  if (d <= 0) return ['agotado', 'Agotado']
  if (d <= Math.max(3, p.stock_minimo)) return ['pocos', `¡Últimas ${d}!`]
  return ['ok', `${d} disponibles`]
}
