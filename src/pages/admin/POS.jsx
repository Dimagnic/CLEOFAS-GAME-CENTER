import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useLectorCodigos } from '../../lib/hardware'
import { buscarSocios, conDescuento, descuentoCupon } from '../../lib/socios'
import { cargarVenta, imprimirVenta, listarVentas, pesos, tipoCodigo, estadoVenta, METODOS, ORIGENES, puntosDeVenta } from '../../lib/ventas'
import { useStations } from '../../lib/StationsStore'
import SocioPicker from './SocioPicker'
import CuponSelector from './CuponSelector'
import EscanerCamara from './EscanerCamara'
import { MetodoPago, useCobro } from './Cobro'
import { cargarConfigTicket } from './Hardware'
import DetalleVenta from './DetalleVenta'

const disponible = (p) => (p.controla_stock ? p.stock - p.apartado : Infinity)

export default function POS() {
  const { refrescar } = useStations()
  const [tab, setTab] = useState('vender')
  const [productos, setProductos] = useState([])
  const [sinStock, setSinStock] = useState(false)
  const [cfg, setCfg] = useState({})
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [carrito, setCarrito] = useState({}) // id → cantidad
  const [socio, setSocio] = useState(null)
  const [cupon, setCupon] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [hecha, setHecha] = useState(null)
  const [abierta, setAbierta] = useState(null) // venta abierta por QR/folio
  const [camara, setCamara] = useState(false)
  const [pendientes, setPendientes] = useState([])

  const cargarProductos = useCallback(async () => {
    const { data, error } = await supabase.from('productos').select('*').eq('activo', true).order('categoria').order('orden').order('nombre')
    if (error) setError(error.message); else setProductos(data)
  }, [])
  const cargarPendientes = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([listarVentas({ estado: 'pendiente', limite: 100 }), listarVentas({ estado: 'pagada', limite: 100 })])
      setPendientes([...p, ...e.filter((v) => v.entrega === 'pendiente' && v.origen !== 'pos')])
    } catch { /* sin POS instalado */ }
  }, [])

  useEffect(() => {
    if (!supabaseReady) return undefined
    cargarProductos(); cargarPendientes()
    cargarConfigTicket().then(setCfg)
    supabase.from('config_negocio').select('valor').eq('clave', 'venta_sin_stock').maybeSingle().then(({ data }) => setSinStock(data?.valor === true))
    // Tiempo real: existencias y pedidos nuevos
    const canal = supabase.channel('pos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, cargarProductos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, cargarPendientes)
      .subscribe()
    const poll = setInterval(cargarPendientes, 30000)
    return () => { supabase.removeChannel(canal); clearInterval(poll) }
  }, [cargarProductos, cargarPendientes])

  const lineas = productos.filter((p) => carrito[p.id] > 0).map((p) => ({ p, cant: carrito[p.id] }))
  const subtotal = lineas.reduce((s, l) => s + Number(l.p.precio) * l.cant, 0)
  const pct = socio?.rangos?.desc_snacks || 0
  const conRango = conDescuento(subtotal, pct)
  const dCupon = descuentoCupon(cupon, conRango, 'snacks')
  const total = conRango - dCupon
  const cobro = useCobro(total)

  function agregar(p, n = 1) {
    setError('')
    setCarrito((c) => {
      const actual = c[p.id] ?? 0
      const nuevo = Math.max(0, actual + n)
      if (n > 0 && !sinStock && nuevo > disponible(p)) {
        setError(`No hay más "${p.nombre}" disponibles (quedan ${Math.max(disponible(p), 0)}).`)
        return c
      }
      const r = { ...c, [p.id]: nuevo }
      if (!nuevo) delete r[p.id]
      return r
    })
  }

  function limpiar() { setCarrito({}); setSocio(null); setCupon(null); cobro.reset(); setError('') }

  // Lector de códigos y QR: producto → carrito · V- → pedido · S- → socio · CL- → pedido de la reserva
  async function procesarCodigo(codigo) {
    setAviso(''); setError('')
    const { tipo, valor } = tipoCodigo(codigo)
    try {
      if (tipo === 'producto') {
        const p = productos.find((x) => x.codigo_barras === valor)
        if (!p) return setError(`Código ${valor} no registrado. Dalo de alta en Inventario.`)
        setTab('vender'); agregar(p); setAviso(`+1 ${p.nombre}`)
      } else if (tipo === 'venta') {
        const v = await cargarVenta({ folio: valor })
        if (!v) return setError(`No existe el pedido ${valor}.`)
        setAbierta(v)
      } else if (tipo === 'socio') {
        const [s] = await buscarSocios(valor)
        if (!s) return setError(`No existe el socio ${valor}.`)
        setTab('vender'); setSocio(s); setAviso(`Socio: ${s.nombre || s.email}`)
      } else if (tipo === 'reserva') {
        const { data } = await supabase.from('reservaciones').select('venta_id').eq('folio', valor).maybeSingle()
        if (!data?.venta_id) return setError(`La reserva ${valor} no tiene pedido de tienda.`)
        setAbierta(await cargarVenta({ id: data.venta_id }))
      }
    } catch (e) { setError(e.message) }
  }
  useLectorCodigos(procesarCodigo, { activo: !hecha && !abierta && !camara })

  async function cobrar() {
    if (!lineas.length || !cobro.valido) return
    setCobrando(true); setError('')
    const { data, error } = await supabase.rpc('pos_vender', {
      p_items: lineas.map((l) => ({ producto_id: l.p.id, cantidad: l.cant })),
      p_metodo: cobro.args.metodo, p_socio: socio?.user_id ?? null, p_cupon: cupon?.id ?? null,
      p_recibido: cobro.args.recibido, p_referencia: cobro.args.referencia, p_cliente: null,
    })
    setCobrando(false)
    if (error) return setError(error.message)
    const venta = await cargarVenta({ id: data.id })
    const puntos = venta.socio_id ? await puntosDeVenta(venta.folio) : 0
    setHecha({ venta, puntos })
    limpiar(); refrescar?.(); cargarProductos()
    if (cfg.auto !== false) imprimirVenta(venta, cfg).catch(() => {})
  }

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))], [productos])
  const visibles = productos.filter((p) => (!cat || p.categoria === cat) &&
    (!q || `${p.nombre} ${p.codigo_barras ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const porCobrar = pendientes.filter((v) => v.estado === 'pendiente' && v.pago_preferido === 'presencial')

  if (!supabaseReady) return <div><header className="admin-page__head"><h1>POS</h1></header><p className="admin-note">Requiere Supabase conectado.</p></div>

  return (
    <div className="pos">
      <header className="admin-page__head admin-page__head--accion">
        <div>
          <h1>Punto de venta</h1>
          <p>Escanea productos, socios (S-…), pedidos (V-…) o reservas (CL-…) con el lector o la cámara.</p>
        </div>
        <div className="pos__top-acciones">
          <button className="btn btn-ghost btn-sm" onClick={() => setCamara(true)}>Escanear con cámara</button>
          <PorFolio onAbrir={procesarCodigo} />
        </div>
      </header>

      <div className="novedades__filtros admin-tabs">
        <button className={tab === 'vender' ? 'is-active' : ''} onClick={() => setTab('vender')}>Vender</button>
        <button className={tab === 'pedidos' ? 'is-active' : ''} onClick={() => setTab('pedidos')}>
          Pedidos de clientes {porCobrar.length > 0 && <b className="pos__badge">{porCobrar.length}</b>}
        </button>
      </div>

      {error && <p className="admin-note admin-note--error">{error}</p>}
      {aviso && <p className="admin-note admin-note--ok">{aviso}</p>}

      {tab === 'vender' ? (
        <div className="tienda">
          <div className="tienda__productos">
            <div className="admin-form-inline">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" />
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas</option>
                {categorias.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {visibles.length === 0 ? <p className="admin-note">Sin productos. Dalos de alta en <strong>Inventario</strong>.</p> : (
              <div className="tienda__grid pos__grid">
                {visibles.map((p) => {
                  const disp = disponible(p)
                  const agotado = disp <= 0 && !sinStock
                  return (
                    <button key={p.id} className={`tienda__item pos__item ${agotado ? 'is-agotado' : ''}`} onClick={() => agregar(p)} disabled={agotado}>
                      {p.imagen_url && <img src={p.imagen_url} alt="" />}
                      <strong>{p.nombre}</strong>
                      <span>{pesos(p.precio)}</span>
                      {p.controla_stock && <small className={disp <= p.stock_minimo ? 'is-bajo' : ''}>{agotado ? 'Agotado' : `${disp} disp.`}</small>}
                      {carrito[p.id] > 0 && <b className="tienda__badge">{carrito[p.id]}</b>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <aside className="tienda__ticket">
            <h2>Venta</h2>
            {lineas.length === 0 ? <p className="admin-note">Escanea o toca un producto.</p> : (
              <ul className="tienda__lineas">
                {lineas.map(({ p, cant }) => (
                  <li key={p.id}>
                    <span>{p.nombre}</span>
                    <span className="tienda__cant">
                      <button onClick={() => agregar(p, -1)} aria-label="Quitar uno">−</button>{cant}<button onClick={() => agregar(p, 1)} aria-label="Agregar uno">+</button>
                    </span>
                    <span>{pesos(p.precio * cant)}</span>
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
            {lineas.length > 0 && <MetodoPago {...cobro.props} />}
            <button className="btn btn-primary" disabled={!lineas.length || cobrando || !cobro.valido} onClick={cobrar}>
              {cobrando ? 'Registrando…' : `Cobrar ${pesos(total)} · ${METODOS[cobro.args.metodo].corto}`}
            </button>
            {lineas.length > 0 && <button className="admin-link" onClick={limpiar}>Vaciar</button>}
          </aside>
        </div>
      ) : (
        <ListaPedidos ventas={pendientes} onAbrir={setAbierta} />
      )}

      {hecha && (
        <div className="admin-modal__backdrop" onClick={() => setHecha(null)}>
          <div className="admin-modal pos__hecha" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Venta registrada</p>
            <h3>{hecha.venta.folio}</h3>
            <p className="pos__hecha-total">{pesos(hecha.venta.total)}</p>
            <p>{METODOS[hecha.venta.metodo_pago]?.etiqueta}{hecha.venta.metodo_pago === 'efectivo' && hecha.venta.cambio != null ? ` · Cambio ${pesos(hecha.venta.cambio)}` : ''}</p>
            {hecha.puntos > 0 && <p className="admin-note admin-note--ok">+{hecha.puntos} puntos para {hecha.venta.cliente}</p>}
            <div className="admin-modal__actions">
              <button className="btn btn-ghost btn-sm" onClick={() => imprimirVenta(hecha.venta, cfg)}>Imprimir ticket</button>
              <button className="btn btn-primary btn-sm" autoFocus onClick={() => setHecha(null)}>Nueva venta</button>
            </div>
          </div>
        </div>
      )}
      {abierta && <DetalleVenta venta={abierta} cfg={cfg} onCerrar={() => setAbierta(null)} onCambio={() => { cargarPendientes(); cargarProductos(); refrescar?.() }} />}
      {camara && <EscanerCamara titulo="Escanear producto, socio o pedido" onCerrar={() => setCamara(false)} onCodigo={(c) => { setCamara(false); procesarCodigo(c) }} />}
    </div>
  )
}

function PorFolio({ onAbrir }) {
  const [v, setV] = useState('')
  return (
    <form className="pos__folio" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAbrir(v); setV('') } }}>
      <input value={v} onChange={(e) => setV(e.target.value.toUpperCase())} placeholder="Folio V-… / CL-… / S-…" />
      <button className="btn btn-ghost btn-sm">Abrir</button>
    </form>
  )
}

function ListaPedidos({ ventas, onAbrir }) {
  const grupos = [
    ['Por cobrar en mostrador', ventas.filter((v) => v.estado === 'pendiente' && v.pago_preferido === 'presencial')],
    ['Pagados, por entregar', ventas.filter((v) => v.estado === 'pagada')],
    ['Esperando pago en línea', ventas.filter((v) => v.estado === 'pendiente' && v.pago_preferido === 'en_linea')],
  ]
  return (
    <div className="pos__pedidos">
      {grupos.map(([titulo, lista]) => (
        <section key={titulo} className="admin-section">
          <h2>{titulo} ({lista.length})</h2>
          {lista.length === 0 ? <p className="admin-note">Nada por aquí.</p> : (
            <div className="pos__pedidos-grid">
              {lista.map((v) => {
                const [clase, texto] = estadoVenta(v)
                return (
                  <button key={v.id} className={`pos__pedido pos__pedido--${clase}`} onClick={() => onAbrir(v)}>
                    <div><code>{v.folio}</code><span>{ORIGENES[v.origen]}{v.reservaciones ? ` · ${v.reservaciones.folio}` : ''}</span></div>
                    <strong>{v.cliente || v.socios?.nombre || 'Cliente'}</strong>
                    <small>{(v.venta_items ?? []).map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}</small>
                    <div><b>{pesos(v.total)}</b><em>{texto}</em></div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
