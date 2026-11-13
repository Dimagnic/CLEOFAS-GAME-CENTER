import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useStations } from '../../lib/StationsStore'
import { conDescuento, pesos, descuentoCupon, canjearCupon } from '../../lib/socios'
import SocioPicker from './SocioPicker'
import CuponSelector from './CuponSelector'

export default function Tienda() {
  const { registrarVenta } = useStations()
  const [productos, setProductos] = useState([])
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState({}) // id → cantidad
  const [socio, setSocio] = useState(null)
  const [cupon, setCupon] = useState(null)
  const [cobrando, setCobrando] = useState(false)
  const [ok, setOk] = useState('')

  async function cargar() {
    const { data, error } = await supabase.from('productos').select('*').order('categoria').order('orden').order('nombre')
    if (error) setError(error.message)
    else { setError(''); setProductos(data) }
  }
  useEffect(() => { if (supabaseReady) cargar() }, [])

  const activos = productos.filter((p) => p.activo)
  const porCategoria = useMemo(() => {
    const m = new Map()
    for (const p of activos) m.set(p.categoria, [...(m.get(p.categoria) ?? []), p])
    return [...m.entries()]
  }, [productos])

  const lineas = Object.entries(ticket).map(([id, cant]) => ({ p: productos.find((x) => x.id === id), cant })).filter((l) => l.p && l.cant > 0)
  const subtotal = lineas.reduce((s, l) => s + Number(l.p.precio) * l.cant, 0)
  const pct = socio?.rangos?.desc_snacks || 0
  const conRango = conDescuento(subtotal, pct)
  const dCupon = descuentoCupon(cupon, conRango, 'snacks')
  const total = conRango - dCupon

  const sumar = (id, n) => setTicket((t) => ({ ...t, [id]: Math.max(0, (t[id] ?? 0) + n) }))

  async function cobrar() {
    if (!lineas.length) return
    setCobrando(true); setError(''); setOk('')
    try {
      // El cupón se canjea primero: si ya se usó o venció, no se cobra con descuento.
      if (cupon) await canjearCupon(cupon, 'Tienda', dCupon)
      await registrarVenta({
        detalle: lineas.map((l) => `${l.cant}× ${l.p.nombre}`).join(', ') + (cupon ? ` · cupón ${cupon.codigo}` : ''),
        total,
        descuento: subtotal - total,
        socio,
      })
      setOk(`Venta registrada: ${pesos(total)}${socio ? ` · +${Math.floor(total)} pts para ${socio.nombre || socio.email}` : ''}`)
      setTicket({}); setSocio(null); setCupon(null)
    } catch (e) {
      setError(e.message); setCupon(null)
    } finally {
      setCobrando(false)
    }
  }

  if (!supabaseReady) {
    return (
      <div>
        <header className="admin-page__head"><h1>Tienda</h1></header>
        <p className="admin-note">La tienda necesita Supabase conectado y la migración <code>supabase/migration-socios.sql</code>.</p>
      </div>
    )
  }

  return (
    <div>
      <header className="admin-page__head">
        <h1>Tienda</h1>
        <p>Vende snacks y bebidas. Cada venta entra a la caja del día y, si es socio, le suma puntos con su descuento.</p>
      </header>

      {error && <p className="admin-note admin-note--error">Error: {error}</p>}
      {ok && <p className="admin-note admin-note--ok">{ok}</p>}

      <div className="tienda">
        <div className="tienda__productos">
          {activos.length === 0 ? (
            <p className="admin-note">Aún no hay productos. Agrégalos abajo en <strong>Productos</strong>.</p>
          ) : porCategoria.map(([cat, lista]) => (
            <section key={cat}>
              <h2 className="tienda__cat">{cat}</h2>
              <div className="tienda__grid">
                {lista.map((p) => (
                  <button key={p.id} className="tienda__item" onClick={() => sumar(p.id, 1)}>
                    <strong>{p.nombre}</strong>
                    <span>{pesos(p.precio)}</span>
                    {ticket[p.id] > 0 && <b className="tienda__badge">{ticket[p.id]}</b>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="tienda__ticket">
          <h2>Venta</h2>
          {lineas.length === 0 ? <p className="admin-note">Toca un producto para agregarlo.</p> : (
            <ul className="tienda__lineas">
              {lineas.map((l) => (
                <li key={l.p.id}>
                  <span>{l.p.nombre}</span>
                  <span className="tienda__cant">
                    <button onClick={() => sumar(l.p.id, -1)} aria-label="Quitar uno">−</button>
                    {l.cant}
                    <button onClick={() => sumar(l.p.id, 1)} aria-label="Agregar uno">+</button>
                  </span>
                  <span>{pesos(l.p.precio * l.cant)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="admin-modal__campo">
            <span>Socio (opcional)</span>
            <SocioPicker value={socio} onChange={setSocio} tipoDescuento="snacks" />
          </div>
          <CuponSelector socio={socio} contexto="snacks" subtotal={conRango} value={cupon} onChange={setCupon} />
          <dl className="tienda__totales">
            <div><dt>Subtotal</dt><dd>{pesos(subtotal)}</dd></div>
            {pct > 0 && <div><dt>Descuento socio ({pct}%)</dt><dd>−{pesos(subtotal - conRango)}</dd></div>}
            {dCupon > 0 && <div><dt>Cupón {cupon.codigo}</dt><dd>−{pesos(dCupon)}</dd></div>}
            <div className="tienda__total"><dt>Total</dt><dd>{pesos(total)}</dd></div>
          </dl>
          <button className="btn btn-primary" disabled={!lineas.length || cobrando} onClick={cobrar}>
            {cobrando ? 'Registrando…' : `Cobrar ${pesos(total)}`}
          </button>
          {lineas.length > 0 && <button className="admin-link" onClick={() => { setTicket({}); setSocio(null); setCupon(null) }}>Vaciar</button>}
        </aside>
      </div>

      <Productos productos={productos} onCambio={cargar} onError={setError} />
    </div>
  )
}

function Productos({ productos, onCambio, onError }) {
  const [guardando, setGuardando] = useState(false)

  async function agregar(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const precio = Number(f.get('precio'))
    if (!(precio >= 0)) return onError('Precio inválido')
    setGuardando(true)
    const { error } = await supabase.from('productos').insert({
      nombre: String(f.get('nombre')).trim(), precio, categoria: String(f.get('categoria') || 'Snacks').trim() || 'Snacks',
    })
    setGuardando(false)
    if (error) return onError(error.message)
    e.target.reset()
    onCambio()
  }

  async function cambiar(id, cambios) {
    const { error } = await supabase.from('productos').update(cambios).eq('id', id)
    if (error) onError(error.message)
    onCambio()
  }

  async function borrar(p) {
    if (!window.confirm(`¿Borrar "${p.nombre}"? Si solo quieres dejar de venderlo, mejor desactívalo.`)) return
    const { error } = await supabase.from('productos').delete().eq('id', p.id)
    if (error) onError(error.message)
    onCambio()
  }

  const categorias = [...new Set(productos.map((p) => p.categoria))]

  return (
    <section className="admin-section">
      <h2>Productos</h2>
      <form className="admin-form-inline" onSubmit={agregar}>
        <input name="nombre" required placeholder="Nombre (ej. Refresco 600 ml)" />
        <input name="precio" required type="number" min="0" step="0.5" placeholder="Precio" />
        <input name="categoria" list="categorias-tienda" placeholder="Categoría (Snacks, Bebidas…)" />
        <datalist id="categorias-tienda">{['Snacks', 'Bebidas', ...categorias].filter((c, i, a) => a.indexOf(c) === i).map((c) => <option key={c} value={c} />)}</datalist>
        <button className="btn btn-primary btn-sm" disabled={guardando}>Agregar</button>
      </form>

      {productos.length > 0 && (
        <table className="admin-table">
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>A la venta</th><th></th></tr></thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className={p.activo ? '' : 'is-apagado'}>
                <td>{p.nombre}</td>
                <td>{p.categoria}</td>
                <td>
                  <input className="admin-input-mini" type="number" min="0" step="0.5" defaultValue={p.precio}
                    onBlur={(e) => Number(e.target.value) !== Number(p.precio) && cambiar(p.id, { precio: Number(e.target.value) })} />
                </td>
                <td><input type="checkbox" checked={p.activo} onChange={(e) => cambiar(p.id, { activo: e.target.checked })} /></td>
                <td><button className="admin-link admin-link--peligro" onClick={() => borrar(p)}>Borrar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
