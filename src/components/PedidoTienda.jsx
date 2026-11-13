import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../lib/supabaseClient'

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`

// Productos a la venta (los lee cualquiera; los precios finales los recalcula el servidor)
export function useProductosTienda() {
  const [productos, setProductos] = useState([])
  useEffect(() => {
    if (!supabaseReady) return
    supabase.from('productos').select('id, nombre, precio, categoria').eq('activo', true).order('categoria').order('orden').order('nombre')
      .then(({ data }) => setProductos(data ?? []), () => setProductos([]))
  }, [])
  return productos
}

// Calcula el pedido: líneas, subtotal, descuento de socio y total
export function calcularPedido(productos, cantidades, pctSnacks = 0) {
  const lineas = productos.filter((p) => cantidades[p.id] > 0).map((p) => ({ ...p, cantidad: cantidades[p.id] }))
  const subtotal = lineas.reduce((s, l) => s + Number(l.precio) * l.cantidad, 0)
  const descuento = Math.round((subtotal * pctSnacks) / 100)
  return { lineas, subtotal, descuento, total: subtotal - descuento, piezas: lineas.reduce((s, l) => s + l.cantidad, 0) }
}

// Selector de snacks y bebidas + elección de pago, dentro del formulario de reserva
export default function PedidoTienda({ productos, cantidades, setCantidades, pago, setPago, pctSnacks, pedido }) {
  const [abierto, setAbierto] = useState(false)
  const porCategoria = useMemo(() => {
    const m = new Map()
    for (const p of productos) m.set(p.categoria, [...(m.get(p.categoria) ?? []), p])
    return [...m.entries()]
  }, [productos])

  if (!productos.length) return null
  const sumar = (id, n) => setCantidades((c) => {
    const v = Math.max(0, Math.min(20, (c[id] ?? 0) + n))
    const nuevo = { ...c, [id]: v }
    if (!v) delete nuevo[id]
    return nuevo
  })

  return (
    <div className={`pedido ${pedido.piezas ? 'pedido--con' : ''}`}>
      <button type="button" className="pedido__toggle" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto || pedido.piezas > 0}>
        <span>
          <strong>Deja listo tu snack</strong>
          <small>{pedido.piezas ? `${pedido.piezas} producto${pedido.piezas > 1 ? 's' : ''} · ${pesos(pedido.total)}` : 'Agrega bebidas y snacks a tu reserva (opcional)'}</small>
        </span>
        <i aria-hidden="true">{abierto || pedido.piezas ? '−' : '+'}</i>
      </button>

      {(abierto || pedido.piezas > 0) && (
        <div className="pedido__cuerpo">
          {pctSnacks > 0 && <p className="pedido__socio">Como socio tienes <b>−{pctSnacks}%</b> en snacks y bebidas.</p>}
          {porCategoria.map(([cat, lista]) => (
            <div key={cat} className="pedido__cat">
              <span className="pedido__catnom">{cat}</span>
              <div className="pedido__lista">
                {lista.map((p) => {
                  const cant = cantidades[p.id] ?? 0
                  return (
                    <div key={p.id} className={`pedido__item ${cant ? 'is-on' : ''}`}>
                      <div>
                        <strong>{p.nombre}</strong>
                        <span>{pesos(p.precio)}</span>
                      </div>
                      <div className="pedido__cant">
                        {cant > 0 && <button type="button" onClick={() => sumar(p.id, -1)} aria-label={`Quitar ${p.nombre}`}>−</button>}
                        {cant > 0 && <b>{cant}</b>}
                        <button type="button" onClick={() => sumar(p.id, 1)} aria-label={`Agregar ${p.nombre}`}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {pedido.piezas > 0 && (
            <fieldset className="pedido__pago">
              <legend>¿Cómo quieres pagar tus productos?</legend>
              <label className={pago === 'en_linea' ? 'is-on' : ''}>
                <input type="radio" name="pagoProductos" checked={pago === 'en_linea'} onChange={() => setPago('en_linea')} />
                <span><strong>Pagar ahora en línea</strong><small>Se cobran junto con tu reserva. Llegas y te los entregamos.</small></span>
              </label>
              <label className={pago === 'efectivo' ? 'is-on' : ''}>
                <input type="radio" name="pagoProductos" checked={pago === 'efectivo'} onChange={() => setPago('efectivo')} />
                <span><strong>Pagar en efectivo en mi visita</strong><small>Los apartamos y los pagas en mostrador el día que vengas.</small></span>
              </label>
            </fieldset>
          )}
        </div>
      )}
    </div>
  )
}
