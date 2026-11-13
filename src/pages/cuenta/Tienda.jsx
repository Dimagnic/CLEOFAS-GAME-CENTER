import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import CuentaMarco from './CuentaMarco'
import { useCatalogo, disponible, etiquetaStock } from '../../lib/catalogo'
import { useMiSocio, cuponesDisponibles, descuentoCupon, textoCupon, conDescuento } from '../../lib/socios'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { api } from '../../lib/reservas'
import { pesos } from '../../lib/ventas'

const CLAVE_CARRITO = 'cleofas_carrito'
const leerCarrito = () => { try { return JSON.parse(localStorage.getItem(CLAVE_CARRITO) || '{}') } catch { return {} } }

export default function TiendaSocio() {
  const { cargando, session, socio, rangos } = useMiSocio()
  const productos = useCatalogo()
  const navigate = useNavigate()
  const [carrito, setCarrito] = useState(leerCarrito)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [pago, setPago] = useState('presencial')
  const [cupones, setCupones] = useState([])
  const [cuponId, setCuponId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { try { localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito)) } catch { /* modo privado */ } }, [carrito])
  useEffect(() => { if (socio) cuponesDisponibles(socio.user_id, 'snacks').then(setCupones, () => setCupones([])) }, [socio?.user_id])

  const rango = rangos.find((r) => r.id === socio?.rango_id)
  const pct = rango?.desc_snacks || 0
  const categorias = useMemo(() => [...new Set((productos ?? []).map((p) => p.categoria))], [productos])
  const visibles = (productos ?? []).filter((p) => (!cat || p.categoria === cat) && (!q || `${p.nombre} ${p.descripcion ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  // Si alguien compró lo último, el carrito se ajusta solo a lo disponible
  const lineas = (productos ?? []).filter((p) => carrito[p.id] > 0).map((p) => ({ p, cant: Math.min(carrito[p.id], disponible(p)) })).filter((l) => l.cant > 0)
  const piezas = lineas.reduce((s, l) => s + l.cant, 0)
  const subtotal = lineas.reduce((s, l) => s + Number(l.p.precio) * l.cant, 0)
  const conRango = conDescuento(subtotal, pct)
  const cupon = cupones.find((c) => c.id === cuponId) ?? null
  const dCupon = descuentoCupon(cupon, conRango, 'snacks')
  const total = conRango - dCupon

  function poner(p, n) {
    setCarrito((c) => {
      const v = Math.max(0, Math.min(20, disponible(p), (c[p.id] ?? 0) + n))
      const r = { ...c, [p.id]: v }
      if (!v) delete r[p.id]
      return r
    })
  }

  async function confirmar() {
    setEnviando(true); setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const r = await api('/api/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ items: lineas.map((l) => ({ id: l.p.id, cantidad: l.cant })), pago, cuponId: cupon?.id ?? null }),
      })
      setCarrito({})
      if (r.url) window.location.href = r.url
      else navigate(`/cuenta/pedidos/${r.folio}?nuevo=1`)
    } catch (e) {
      setError(e.message)
      setEnviando(false)
    }
  }

  if (!supabaseReady) return <Navigate to="/cuenta/entrar" replace />
  if (!cargando && !session) return <Navigate to="/cuenta/entrar" replace state={{ aviso: 'Inicia sesión para comprar en la tienda del Club.' }} />

  return (
    <CuentaMarco ancho>
      <div className="tienda-s__head">
        <div>
          <p className="eyebrow">Tienda del Club</p>
          <h1>Snacks y bebidas</h1>
          <p className="cuenta-muted">Pide desde aquí y recoge en mostrador. {pct > 0 && <b className="tienda-s__pct">Tienes −{pct}% como socio {rango?.nombre}.</b>} Ganas puntos al pagar.</p>
        </div>
        <button className="tienda-s__carrito-btn" onClick={() => setAbierto(true)} disabled={!piezas}>
          Carrito <b>{piezas}</b> {piezas > 0 && <span>{pesos(total)}</span>}
        </button>
      </div>

      <div className="tienda-s__filtros">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" />
        <div className="novedades__filtros">
          <button className={!cat ? 'is-active' : ''} onClick={() => setCat('')}>Todo</button>
          {categorias.map((c) => <button key={c} className={cat === c ? 'is-active' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>

      {!productos ? <div className="cuenta-esqueleto"><div /><div /></div> : visibles.length === 0 ? (
        <p className="cuenta-muted">No hay productos por ahora.</p>
      ) : (
        <div className="tienda-s__grid">
          {visibles.map((p) => {
            const et = etiquetaStock(p)
            const agotado = et?.[0] === 'agotado'
            const cant = carrito[p.id] ?? 0
            return (
              <article key={p.id} className={`producto ${agotado ? 'is-agotado' : ''} ${cant ? 'is-en-carrito' : ''}`}>
                <div className="producto__foto">
                  {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} loading="lazy" /> : <span>{p.nombre.slice(0, 1)}</span>}
                  {et && <em className={`producto__stock producto__stock--${et[0]}`}>{et[1]}</em>}
                </div>
                <div className="producto__cuerpo">
                  <span className="producto__cat">{p.categoria}</span>
                  <h3>{p.nombre}</h3>
                  {p.descripcion && <p>{p.descripcion}</p>}
                  <div className="producto__pie">
                    <div className="producto__precio">
                      {pct > 0 && <s>{pesos(p.precio)}</s>}
                      <b>{pesos(Math.round(Number(p.precio) * (100 - pct)) / 100)}</b>
                    </div>
                    {cant > 0 ? (
                      <div className="producto__cant">
                        <button onClick={() => poner(p, -1)} aria-label={`Quitar ${p.nombre}`}>−</button>
                        <b>{cant}</b>
                        <button onClick={() => poner(p, 1)} disabled={cant >= disponible(p)} aria-label={`Agregar ${p.nombre}`}>+</button>
                      </div>
                    ) : (
                      <button className="btn btn-primary btn-sm" disabled={agotado} onClick={() => poner(p, 1)}>{agotado ? 'Agotado' : 'Agregar'}</button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {piezas > 0 && !abierto && (
        <button className="tienda-s__flotante" onClick={() => setAbierto(true)}>Ver carrito · {piezas} · {pesos(total)}</button>
      )}

      {abierto && (
        <div className="cuenta-modal tienda-s__panel" onClick={() => setAbierto(false)}>
          <aside className="tienda-s__cajon" onClick={(e) => e.stopPropagation()}>
            <div className="cuenta-panel__head"><h2>Tu pedido</h2><button className="cuenta-link" onClick={() => setAbierto(false)}>Cerrar</button></div>
            {lineas.length === 0 ? <p className="cuenta-muted">Tu carrito está vacío.</p> : (
              <>
                <ul className="tienda-s__lineas">
                  {lineas.map(({ p, cant }) => (
                    <li key={p.id}>
                      <span>{p.nombre}</span>
                      <span className="producto__cant">
                        <button onClick={() => poner(p, -1)}>−</button><b>{cant}</b><button onClick={() => poner(p, 1)} disabled={cant >= disponible(p)}>+</button>
                      </span>
                      <span>{pesos(Number(p.precio) * cant)}</span>
                    </li>
                  ))}
                </ul>
                {cupones.length > 0 && (
                  <label className="tienda-s__cupon">Cupón
                    <select value={cuponId} onChange={(e) => setCuponId(e.target.value)}>
                      <option value="">No usar cupón ({cupones.length} disponible{cupones.length > 1 ? 's' : ''})</option>
                      {cupones.map((c) => <option key={c.id} value={c.id}>{c.titulo} — {textoCupon(c)}</option>)}
                    </select>
                  </label>
                )}
                <dl className="booking__cuenta">
                  <div><dt>Subtotal</dt><dd>{pesos(subtotal)}</dd></div>
                  {pct > 0 && <div><dt>Descuento socio ({pct}%)</dt><dd>−{pesos(subtotal - conRango)}</dd></div>}
                  {dCupon > 0 && <div><dt>Cupón</dt><dd>−{pesos(dCupon)}</dd></div>}
                  <div className="booking__cuenta-total"><dt>Total</dt><dd>{pesos(total)}</dd></div>
                </dl>
                <fieldset className="pedido__pago">
                  <legend>¿Cómo quieres pagar?</legend>
                  <label className={pago === 'en_linea' ? 'is-on' : ''}>
                    <input type="radio" checked={pago === 'en_linea'} onChange={() => setPago('en_linea')} />
                    <span><strong>Pagar ahora en línea</strong><small>Con tarjeta. Tu pedido queda pagado; solo recógelo.</small></span>
                  </label>
                  <label className={pago === 'presencial' ? 'is-on' : ''}>
                    <input type="radio" checked={pago === 'presencial'} onChange={() => setPago('presencial')} />
                    <span><strong>Pagar al recoger</strong><small>Efectivo, tarjeta o transferencia en mostrador. Lo apartamos por un tiempo limitado.</small></span>
                  </label>
                </fieldset>
                {pago === 'en_linea' && total > 0 && total < 10 && <p className="admin-login__error">El pago en línea mínimo es de $10. Elige pagar al recoger o agrega más productos.</p>}
                {error && <p className="admin-login__error">{error}</p>}
                <button className="btn btn-primary" disabled={enviando || (pago === 'en_linea' && total > 0 && total < 10)} onClick={confirmar}>
                  {enviando ? 'Procesando…' : pago === 'en_linea' && total > 0 ? `Pagar ${pesos(total)}` : 'Confirmar pedido'}
                </button>
                <p className="cuenta-nota">Los puntos se suman cuando tu pedido queda pagado. Recibirás un QR para identificarte en mostrador.</p>
              </>
            )}
          </aside>
        </div>
      )}
      <p className="cuenta-nota">¿Vienes a jugar? <Link to="/reservar" className="cuenta-link">Reserva tu estación</Link> y agrega tus productos ahí mismo.</p>
    </CuentaMarco>
  )
}
