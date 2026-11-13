import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useLectorCodigos } from '../../lib/hardware'
import { fechaCorta } from '../../lib/socios'
import EscanerCamara from './EscanerCamara'

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
const TIPOS_MOV = { entrada: 'Entrada', venta: 'Venta', devolucion: 'Devolución', ajuste: 'Ajuste', merma: 'Merma' }
const VACIO = { nombre: '', descripcion: '', categoria: 'Snacks', precio: '', costo: '', codigo_barras: '', imagen_url: '', stock: 0, stock_minimo: 3, controla_stock: true, activo: true }

export function estadoStock(p) {
  if (!p.controla_stock) return ['libre', 'Sin control']
  const disp = p.stock - p.apartado
  if (disp <= 0) return ['agotado', 'Agotado']
  if (disp <= p.stock_minimo) return ['bajo', 'Stock bajo']
  return ['ok', 'Disponible']
}

export default function Inventario() {
  const [tab, setTab] = useState('catalogo')
  const [productos, setProductos] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState(null)
  const [moviendo, setMoviendo] = useState(null)

  async function cargar() {
    const { data, error } = await supabase.rpc('productos_admin')
    if (error) return setError(`${error.message}. ¿Ya ejecutaste supabase/migration-pos.sql?`)
    setError(''); setProductos(data)
  }
  useEffect(() => {
    if (!supabaseReady) return undefined
    cargar()
    // Tiempo real: si el POS o la tienda venden, el inventario se actualiza solo
    const canal = supabase.channel('inventario-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  // Lector de códigos: busca el producto o abre el alta con ese código
  useLectorCodigos((codigo) => {
    if (editando || moviendo) return
    const p = (productos ?? []).find((x) => x.codigo_barras === codigo)
    if (p) { setTab('catalogo'); setQ(codigo) } else setEditando({ ...VACIO, codigo_barras: codigo })
  }, { activo: tab === 'catalogo' })

  const categorias = useMemo(() => [...new Set((productos ?? []).map((p) => p.categoria))], [productos])
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (productos ?? []).filter((p) =>
      (!cat || p.categoria === cat) &&
      (!filtro || estadoStock(p)[0] === filtro || (filtro === 'inactivo' && !p.activo)) &&
      (!t || `${p.nombre} ${p.codigo_barras ?? ''} ${p.descripcion ?? ''}`.toLowerCase().includes(t)))
  }, [productos, q, cat, filtro])

  const stats = useMemo(() => {
    const ps = (productos ?? []).filter((p) => p.activo)
    return {
      productos: ps.length,
      valor: ps.reduce((s, p) => s + (p.controla_stock ? p.stock * Number(p.costo || 0) : 0), 0),
      bajo: ps.filter((p) => estadoStock(p)[0] === 'bajo').length,
      agotados: ps.filter((p) => estadoStock(p)[0] === 'agotado').length,
    }
  }, [productos])

  async function alternar(p) {
    const { error } = await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    if (error) setError(error.message); else cargar()
  }
  async function borrar(p) {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? Las ventas anteriores conservan su nombre y precio. Si solo quieres dejar de venderlo, mejor desactívalo.`)) return
    const { error } = await supabase.from('productos').delete().eq('id', p.id)
    if (error) setError(error.message); else { setMsg(`"${p.nombre}" eliminado.`); cargar() }
  }

  if (!supabaseReady) return <div><header className="admin-page__head"><h1>Inventario</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>

  return (
    <div>
      <header className="admin-page__head admin-page__head--accion">
        <div>
          <h1>Inventario</h1>
          <p>Catálogo, existencias y movimientos. Se sincroniza al instante con el POS y la tienda de los socios.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditando(VACIO)}>Nuevo producto</button>
      </header>

      <div className="admin-cards">
        <div className="admin-card"><p className="admin-card__label">Productos activos</p><p className="admin-card__value">{stats.productos}</p></div>
        <div className="admin-card"><p className="admin-card__label">Valor del inventario (costo)</p><p className="admin-card__value">{pesos(stats.valor)}</p></div>
        <div className="admin-card admin-card--alerta" onClick={() => { setTab('catalogo'); setFiltro('bajo') }}><p className="admin-card__label">Stock bajo</p><p className="admin-card__value">{stats.bajo}</p></div>
        <div className="admin-card admin-card--peligro" onClick={() => { setTab('catalogo'); setFiltro('agotado') }}><p className="admin-card__label">Agotados</p><p className="admin-card__value">{stats.agotados}</p></div>
      </div>

      {error && <p className="admin-note admin-note--error">{error}</p>}
      {msg && <p className="admin-note admin-note--ok">{msg}</p>}

      <div className="novedades__filtros admin-tabs">
        {[['catalogo', 'Catálogo'], ['movimientos', 'Movimientos'], ['config', 'Configuración']].map(([k, t]) => (
          <button key={k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>

      {tab === 'catalogo' && (
        <>
          <div className="admin-form-inline">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o escanea un código de barras" />
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todos</option>
              <option value="bajo">Stock bajo</option>
              <option value="agotado">Agotados</option>
              <option value="inactivo">Desactivados</option>
            </select>
          </div>
          {!productos && !error ? <p className="admin-note">Cargando…</p> : lista.length === 0 ? (
            <p className="admin-note">{productos?.length ? 'Ningún producto coincide.' : 'Aún no hay productos. Crea el primero o escanea su código de barras.'}</p>
          ) : (
            <table className="admin-table inv-tabla">
              <thead><tr><th></th><th>Producto</th><th>Código</th><th>Precio</th><th>Costo / margen</th><th>Existencia</th><th>Vendidos 30 días</th><th></th></tr></thead>
              <tbody>
                {lista.map((p) => {
                  const [clase, texto] = estadoStock(p)
                  const margen = Number(p.precio) > 0 && Number(p.costo) > 0 ? Math.round(((p.precio - p.costo) / p.precio) * 100) : null
                  return (
                    <tr key={p.id} className={p.activo ? '' : 'is-apagado'}>
                      <td>{p.imagen_url ? <img className="inv-foto" src={p.imagen_url} alt="" /> : <span className="inv-foto inv-foto--vacia" />}</td>
                      <td><strong>{p.nombre}</strong><br /><span className="mono">{p.categoria}{p.activo ? '' : ' · desactivado'}</span></td>
                      <td className="mono">{p.codigo_barras || '—'}</td>
                      <td>{pesos(p.precio)}</td>
                      <td>{Number(p.costo) ? pesos(p.costo) : '—'}{margen != null && <><br /><span className="mono">{margen}%</span></>}</td>
                      <td>
                        {p.controla_stock ? (
                          <><b className="inv-num">{p.stock - p.apartado}</b> <span className="mono">disp.</span>
                            {p.apartado > 0 && <><br /><span className="mono">{p.stock} en almacén · {p.apartado} apartados</span></>}
                            <br /><span className={`inv-estado inv-estado--${clase}`}>{texto}</span>
                          </>
                        ) : <span className="inv-estado inv-estado--libre">{texto}</span>}
                      </td>
                      <td>{p.vendidos_30d}</td>
                      <td className="inv-acciones">
                        {p.controla_stock && <button className="admin-link" onClick={() => setMoviendo(p)}>Entrada / ajuste</button>}
                        <button className="admin-link" onClick={() => setEditando(p)}>Editar</button>
                        <button className="admin-link" onClick={() => alternar(p)}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                        <button className="admin-link admin-link--peligro" onClick={() => borrar(p)}>Eliminar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === 'movimientos' && <Movimientos productos={productos ?? []} />}
      {tab === 'config' && <ConfigInventario />}

      {editando && <EditorProducto inicial={editando} categorias={categorias} productos={productos ?? []} onCerrar={() => setEditando(null)}
        onGuardado={(texto) => { setEditando(null); setMsg(texto); cargar() }} />}
      {moviendo && <MovimientoStock p={moviendo} onCerrar={() => setMoviendo(null)} onHecho={(texto) => { setMoviendo(null); setMsg(texto); cargar() }} />}
    </div>
  )
}

function EditorProducto({ inicial, categorias, productos, onCerrar, onGuardado }) {
  const [p, setP] = useState({ ...VACIO, ...inicial, costo: inicial.costo ?? '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [camara, setCamara] = useState(false)
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const campo = (k) => ({ value: p[k] ?? '', onChange: (e) => set(k, e.target.value) })
  const nuevo = !p.id

  // Con el editor abierto, el lector llena el código de barras
  useLectorCodigos((codigo) => set('codigo_barras', codigo))

  async function subir(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return setError('La foto pesa más de 3 MB.')
    setSubiendo(true); setError('')
    const nombre = `${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`
    const { error } = await supabase.storage.from('productos').upload(nombre, file, { cacheControl: '31536000' })
    setSubiendo(false)
    if (error) return setError(`No se pudo subir la foto (${error.message}). Puedes pegar el enlace de una imagen.`)
    set('imagen_url', supabase.storage.from('productos').getPublicUrl(nombre).data.publicUrl)
  }

  async function guardar(e) {
    e.preventDefault()
    const precio = Number(p.precio)
    const costo = p.costo === '' ? 0 : Number(p.costo)
    const codigo = String(p.codigo_barras ?? '').trim()
    if (String(p.nombre).trim().length < 2) return setError('Escribe el nombre del producto.')
    if (!(precio >= 0) || p.precio === '') return setError('Precio inválido.')
    if (!(costo >= 0)) return setError('Costo inválido.')
    if (codigo && productos.some((x) => x.codigo_barras === codigo && x.id !== p.id)) return setError('Ese código de barras ya es de otro producto.')
    setGuardando(true); setError('')
    const datos = {
      nombre: String(p.nombre).trim(), descripcion: String(p.descripcion ?? '').trim() || null, categoria: String(p.categoria).trim() || 'Snacks',
      precio, codigo_barras: codigo || null, imagen_url: String(p.imagen_url ?? '').trim() || null,
      stock_minimo: Math.max(0, Math.trunc(Number(p.stock_minimo) || 0)), controla_stock: Boolean(p.controla_stock), activo: Boolean(p.activo),
    }
    let id = p.id
    if (nuevo) {
      const { data, error } = await supabase.from('productos').insert({ ...datos, stock: Math.max(0, Math.trunc(Number(p.stock) || 0)) }).select('id').single()
      if (error) { setGuardando(false); return setError(error.message) }
      id = data.id
    } else {
      const { error } = await supabase.from('productos').update(datos).eq('id', id)
      if (error) { setGuardando(false); return setError(error.message) }
    }
    const { error: e2 } = await supabase.from('producto_costos').upsert({ producto_id: id, costo, updated_at: new Date().toISOString() })
    setGuardando(false)
    if (e2) return setError(`Producto guardado, pero no el costo: ${e2.message}`)
    onGuardado(`"${datos.nombre}" ${nuevo ? 'creado' : 'actualizado'}.`)
  }

  return (
    <div className="admin-modal__backdrop" onClick={onCerrar}>
      <form className="admin-modal admin-modal--ancho prod-editor" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3>{nuevo ? 'Nuevo producto' : `Editar ${inicial.nombre}`}</h3>
        <div className="prod-editor__grid">
          <label className="prod-editor__ancho">Nombre<input {...campo('nombre')} maxLength={80} autoFocus /></label>
          <label className="prod-editor__ancho">Descripción (la ven los socios)<textarea {...campo('descripcion')} rows={2} maxLength={240} /></label>
          <label>Categoría
            <input {...campo('categoria')} list="cats-inv" />
            <datalist id="cats-inv">{['Bebidas', 'Snacks', 'Dulces', ...categorias].filter((c, i, a) => a.indexOf(c) === i).map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label>Código de barras
            <span className="prod-editor__fila">
              <input {...campo('codigo_barras')} placeholder="Escanéalo con el lector" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCamara(true)}>Cámara</button>
            </span>
          </label>
          <label>Precio de venta<input type="number" min="0" step="0.5" {...campo('precio')} /></label>
          <label>Costo (privado)<input type="number" min="0" step="0.01" {...campo('costo')} /></label>
          {nuevo && <label>Existencia inicial<input type="number" min="0" step="1" {...campo('stock')} /></label>}
          <label>Alerta de stock bajo en<input type="number" min="0" step="1" {...campo('stock_minimo')} /></label>
          <label className="prod-editor__ancho">Foto
            <span className="prod-editor__foto">
              {p.imagen_url ? <img src={p.imagen_url} alt="" /> : <span className="inv-foto inv-foto--vacia" />}
              <span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={subir} disabled={subiendo} />
                <input {...campo('imagen_url')} placeholder="…o pega el enlace de una imagen" />
                {subiendo && <small>Subiendo…</small>}
              </span>
            </span>
          </label>
          <label className="prod-editor__check"><input type="checkbox" checked={p.controla_stock} onChange={(e) => set('controla_stock', e.target.checked)} /> Controlar existencias (descontar al vender)</label>
          <label className="prod-editor__check"><input type="checkbox" checked={p.activo} onChange={(e) => set('activo', e.target.checked)} /> A la venta</label>
        </div>
        {!nuevo && p.controla_stock && <p className="socio-picker__nota">Para cambiar la existencia usa "Entrada / ajuste": así queda registrado en Movimientos.</p>}
        {error && <p className="admin-note admin-note--error">{error}</p>}
        <div className="admin-modal__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={guardando || subiendo}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
        {camara && <EscanerCamara titulo="Escanear código del producto" onCerrar={() => setCamara(false)} onCodigo={(c) => { set('codigo_barras', c); setCamara(false) }} />}
      </form>
    </div>
  )
}

function MovimientoStock({ p, onCerrar, onHecho }) {
  const [tipo, setTipo] = useState('entrada')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const cantidad = Math.trunc(Number(f.get('cantidad')))
    if (!cantidad) return setError('Escribe la cantidad.')
    setGuardando(true); setError('')
    const { data, error } = await supabase.rpc('mover_inventario', { p_producto: p.id, p_tipo: tipo, p_cantidad: cantidad, p_nota: String(f.get('nota') || '') || null })
    setGuardando(false)
    if (error) return setError(error.message)
    onHecho(`${p.nombre}: ahora hay ${data.stock} en almacén.`)
  }
  return (
    <div className="admin-modal__backdrop" onClick={onCerrar}>
      <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3>{p.nombre}</h3>
        <p className="socio-picker__nota">En almacén: {p.stock} · apartados por pedidos: {p.apartado}</p>
        <div className="novedades__filtros">
          {[['entrada', 'Entrada (compra)'], ['ajuste', 'Ajuste (conteo)'], ['merma', 'Merma (dañado)']].map(([k, t]) => (
            <button type="button" key={k} className={tipo === k ? 'is-active' : ''} onClick={() => setTipo(k)}>{t}</button>
          ))}
        </div>
        <label>{tipo === 'ajuste' ? 'Cantidad (+ suma, − resta)' : 'Cantidad'}<input name="cantidad" type="number" step="1" min={tipo === 'ajuste' ? undefined : 1} autoFocus /></label>
        <label>Nota (opcional)<input name="nota" placeholder={tipo === 'entrada' ? 'Proveedor, factura…' : 'Motivo'} maxLength={200} /></label>
        {error && <p className="admin-modal__aviso">{error}</p>}
        <div className="admin-modal__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </form>
    </div>
  )
}

function Movimientos({ productos }) {
  const [movs, setMovs] = useState(null)
  const [producto, setProducto] = useState('')
  const [tipo, setTipo] = useState('')
  useEffect(() => {
    let consulta = supabase.from('inventario_movs').select('*, productos(nombre)').order('created_at', { ascending: false }).limit(300)
    if (producto) consulta = consulta.eq('producto_id', producto)
    if (tipo) consulta = consulta.eq('tipo', tipo)
    consulta.then(({ data }) => setMovs(data ?? []))
  }, [producto, tipo])
  return (
    <section>
      <div className="admin-form-inline">
        <select value={producto} onChange={(e) => setProducto(e.target.value)}>
          <option value="">Todos los productos</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_MOV).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </div>
      {!movs ? <p className="admin-note">Cargando…</p> : movs.length === 0 ? <p className="admin-note">Sin movimientos.</p> : (
        <table className="admin-table">
          <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Existencia</th><th>Nota</th><th>Quién</th></tr></thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.id}>
                <td className="mono">{fechaCorta(m.created_at)}</td>
                <td>{m.productos?.nombre ?? '—'}</td>
                <td><span className={`inv-mov inv-mov--${m.tipo}`}>{TIPOS_MOV[m.tipo]}</span></td>
                <td className={m.cantidad < 0 ? 'txt-neg' : 'txt-pos'}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
                <td className="mono">{m.stock_antes} → {m.stock_despues}</td>
                <td>{m.nota ?? ''}</td>
                <td className="mono">{String(m.creado_por ?? '').split('@')[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ConfigInventario() {
  const [cfg, setCfg] = useState(null)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    supabase.from('config_negocio').select('*').then(({ data }) => setCfg(Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor]))))
  }, [])
  async function guardar(clave, valor) {
    const { error } = await supabase.from('config_negocio').upsert({ clave, valor, updated_at: new Date().toISOString() })
    setMsg(error ? `Error: ${error.message}` : 'Guardado.')
    if (!error) setCfg((c) => ({ ...c, [clave]: valor }))
  }
  if (!cfg) return <p className="admin-note">Cargando…</p>
  return (
    <section className="inv-config">
      <label className="prod-editor__check">
        <input type="checkbox" checked={cfg.venta_sin_stock === true} onChange={(e) => guardar('venta_sin_stock', e.target.checked)} />
        Permitir vender productos sin existencias (el stock puede quedar en negativo)
      </label>
      <label>Los pedidos de la tienda para pagar en mostrador se apartan por (horas)
        <input type="number" min="1" max="168" defaultValue={cfg.pedido_vigencia_horas ?? 24} onBlur={(e) => guardar('pedido_vigencia_horas', Math.max(1, Number(e.target.value) || 24))} />
      </label>
      <p className="socio-picker__nota">La configuración del ticket y la impresora está en Panel → Hardware.</p>
      {msg && <p className="admin-note admin-note--ok">{msg}</p>}
    </section>
  )
}
