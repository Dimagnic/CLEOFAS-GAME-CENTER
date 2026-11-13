import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useAuth, traducirError } from '../../lib/AuthContext'
import { useMiSocio, progreso, pesos, fechaCorta, ETIQUETA_MOV } from '../../lib/socios'
import { errorDeUrl } from './Acceso'
import Particulas from '../../components/Particulas'
import '../admin/admin.css'
import './cuenta.css'

const ICONO = {
  reserva: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  sesion: 'M3 4h18v12H3zM8 20h8M12 16v4',
  snack: 'M6 2h12l-1 20H7zM6 7h12',
  ajuste: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
}

function Icono({ d }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

function CodigoQR({ codigo }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(codigo, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#03050A', light: '#FFFFFF' } })
      .then(setSvg).catch(() => setSvg(''))
  }, [codigo])
  return <div className="cuenta-qr__img" role="img" aria-label={`Código QR de socio ${codigo}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

export default function MiCuenta() {
  const { esEquipo, signOut } = useAuth()
  const { cargando, session, socio, rangos, movimientos, error, recargar } = useMiSocio()
  const navigate = useNavigate()
  const location = useLocation()
  const [aviso, setAviso] = useState(location.state?.aviso || '')
  const [qrGrande, setQrGrande] = useState(false)
  const bienvenida = new URLSearchParams(location.search).get('bienvenida')

  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => {
    if (bienvenida) { setAviso('¡Tu cuenta está activa! Bienvenido al Club Cleofas.'); window.history.replaceState({}, '', '/cuenta') }
  }, [bienvenida])

  const p = useMemo(() => (socio && rangos.length ? progreso(rangos, socio.puntos, socio.rango_id) : null), [socio, rangos])
  const resumen = useMemo(() => {
    const gastado = movimientos.reduce((s, m) => s + (m.tipo !== 'ajuste' ? Number(m.monto || 0) : 0), 0)
    const visitas = movimientos.filter((m) => m.tipo === 'sesion' || m.tipo === 'reserva').length
    return { gastado, visitas }
  }, [movimientos])

  if (!supabaseReady) return <Navigate to="/cuenta/entrar" replace />
  if (!cargando && !session) {
    const e = errorDeUrl()
    return <Navigate to="/cuenta/entrar" replace state={e ? { error: e } : undefined} />
  }

  async function salir() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="cuenta">
      <Particulas />
      <header className="cuenta__top">
        <div className="cuenta__wrap cuenta__top-row">
          <Link to="/" className="cuenta__brand">
            <img src="/logo.jpg" alt="" width="34" height="34" />
            <span>CLUB <em>CLEOFAS</em></span>
          </Link>
          <nav className="cuenta__nav">
            <a href="/#reservar">Reservar</a>
            {esEquipo && <Link to="/panel">Panel</Link>}
            <button onClick={salir}>Salir</button>
          </nav>
        </div>
      </header>

      <main className="cuenta__wrap cuenta__main">
        {aviso && <p className="cuenta-ok cuenta-ok--banner" onClick={() => setAviso('')}>{aviso}</p>}

        {cargando ? (
          <div className="cuenta-esqueleto" aria-busy="true"><div /><div /><div /></div>
        ) : error ? (
          <p className="admin-login__error">No pudimos cargar tu cuenta ({error}). <button className="cuenta-link" onClick={recargar}>Reintentar</button></p>
        ) : !socio ? (
          <section className="cuenta-panel">
            <h1>Tu cuenta aún no tiene perfil de socio</h1>
            <p className="cuenta-muted">
              {esEquipo ? 'Esta es una cuenta del equipo. Puedes entrar al panel de control.' : 'Escríbenos por WhatsApp y lo activamos en un momento.'}
            </p>
            {esEquipo && <Link to="/panel" className="btn btn-primary">Ir al panel</Link>}
          </section>
        ) : (
          <>
            <section className="cuenta-hero">
              <div>
                <p className="eyebrow">Club Cleofas · socio desde {new Date(socio.created_at).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })}</p>
                <h1>Hola, {socio.nombre?.split(' ')[0] || 'jugador'}</h1>
              </div>
              <div className="cuenta-hero__stats">
                <div><b>{socio.puntos.toLocaleString('es-MX')}</b><span>puntos</span></div>
                <div><b>{resumen.visitas}</b><span>visitas</span></div>
                <div><b>{pesos(resumen.gastado)}</b><span>consumo</span></div>
              </div>
            </section>

            <div className="cuenta-grid">
              <section className="cuenta-carnet" style={{ '--rango': p?.actual?.color || '#9FB0CC' }}>
                <div className="cuenta-carnet__brillo" aria-hidden="true" />
                <div className="cuenta-carnet__top">
                  <span className="cuenta-carnet__club">CLEOFAS · MEMBER</span>
                  <span className="cuenta-carnet__rango">{p?.actual?.nombre}{socio.rango_manual ? ' ★' : ''}</span>
                </div>
                <p className="cuenta-carnet__nombre">{socio.nombre || socio.email}</p>
                <p className="cuenta-carnet__codigo">{socio.codigo}</p>

                <div className="cuenta-progreso">
                  {p?.siguiente ? (
                    <>
                      <div className="cuenta-progreso__txt">
                        <span>{p.actual.nombre}</span>
                        <span>Te faltan <b>{p.faltan.toLocaleString('es-MX')} pts</b> para <b style={{ color: p.siguiente.color }}>{p.siguiente.nombre}</b></span>
                      </div>
                      <div className="cuenta-progreso__barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.avance * 100)}>
                        <i style={{ width: `${Math.max(3, p.avance * 100)}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="cuenta-progreso__txt"><span>Estás en el rango más alto. ¡Leyenda total!</span></p>
                  )}
                </div>
              </section>

              <section className="cuenta-qr">
                <button className="cuenta-qr__btn" onClick={() => setQrGrande(true)} aria-label="Ver QR en grande">
                  <CodigoQR codigo={socio.codigo} />
                </button>
                <div>
                  <h2>Tu QR de socio</h2>
                  <p className="cuenta-muted">Muéstralo en mostrador al jugar o comprar snacks: sumas puntos y se aplica tu descuento.</p>
                  <button className="cuenta-link" onClick={() => setQrGrande(true)}>Ver en grande</button>
                </div>
              </section>
            </div>

            <div className="cuenta-grid">
              <section className="cuenta-panel">
                <h2>Tus beneficios · {p?.actual?.nombre}</h2>
                <div className="cuenta-chips">
                  <span className="cuenta-chip"><b>{p?.actual?.desc_horas ?? 0}%</b> en horas y paquetes</span>
                  <span className="cuenta-chip"><b>{p?.actual?.desc_snacks ?? 0}%</b> en snacks y bebidas</span>
                </div>
                <ul className="cuenta-lista">
                  {(p?.actual?.beneficios ?? []).map((b) => <li key={b}>{b}</li>)}
                </ul>
                <p className="cuenta-muted cuenta-nota">Tu descuento en horas se aplica solo al reservar en línea con tu sesión iniciada, y en mostrador al mostrar tu QR.</p>
              </section>

              <section className="cuenta-panel">
                <h2>Rangos del club</h2>
                <ol className="cuenta-rangos">
                  {rangos.map((r) => {
                    const actual = r.id === p?.actual?.id
                    const logrado = socio.puntos >= r.min_puntos || actual
                    return (
                      <li key={r.id} className={`${actual ? 'is-actual' : ''} ${logrado ? 'is-logrado' : ''}`} style={{ '--rango': r.color }}>
                        <i aria-hidden="true" />
                        <div>
                          <strong>{r.nombre}</strong>
                          <span>{r.min_puntos === 0 ? 'Al crear tu cuenta' : `Desde ${r.min_puntos.toLocaleString('es-MX')} pts`}</span>
                        </div>
                        <em>{r.desc_horas > 0 || r.desc_snacks > 0 ? `-${r.desc_horas}% horas · -${r.desc_snacks}% snacks` : 'Acumula puntos'}</em>
                      </li>
                    )
                  })}
                </ol>
              </section>
            </div>

            <section className="cuenta-panel">
              <h2>Historial</h2>
              {movimientos.length === 0 ? (
                <p className="cuenta-muted">Aún no hay movimientos. Reserva en línea con tu sesión iniciada o muestra tu QR en mostrador y aquí verás cada visita, compra y punto ganado.</p>
              ) : (
                <ul className="cuenta-historial">
                  {movimientos.map((m) => (
                    <li key={m.id} className={`cuenta-historial__item cuenta-historial__item--${m.tipo}`}>
                      <span className="cuenta-historial__ico"><Icono d={ICONO[m.tipo] ?? ICONO.ajuste} /></span>
                      <div>
                        <strong>{m.descripcion || ETIQUETA_MOV[m.tipo]}</strong>
                        <span>{ETIQUETA_MOV[m.tipo]} · {fechaCorta(m.created_at)}</span>
                      </div>
                      <div className="cuenta-historial__num">
                        {Number(m.monto) > 0 && <span>{pesos(m.monto)}</span>}
                        <b className={m.puntos < 0 ? 'neg' : ''}>{m.puntos > 0 ? '+' : ''}{m.puntos} pts</b>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <MisDatos socio={socio} onGuardado={recargar} />
          </>
        )}
      </main>

      {qrGrande && socio && (
        <div className="cuenta-modal" onClick={() => setQrGrande(false)} role="dialog" aria-label="QR de socio">
          <div className="cuenta-modal__caja" onClick={(e) => e.stopPropagation()}>
            <CodigoQR codigo={socio.codigo} />
            <p className="cuenta-carnet__codigo">{socio.codigo}</p>
            <p className="cuenta-muted">{socio.nombre} · {p?.actual?.nombre}</p>
            <button className="btn btn-ghost" onClick={() => setQrGrande(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MisDatos({ socio, onGuardado }) {
  const [abierto, setAbierto] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setMsg(''); setError('')
    const f = new FormData(e.target)
    const nombre = String(f.get('nombre')).trim()
    const telefono = String(f.get('telefono') || '').replace(/\D/g, '')
    if (nombre.length < 2) return setError('Escribe tu nombre.')
    if (telefono && (telefono.length < 8 || telefono.length > 15)) return setError('El teléfono no parece válido.')
    setGuardando(true)
    const { error } = await supabase.from('socios').update({ nombre, telefono: telefono || null }).eq('user_id', socio.user_id)
    let errClave = null
    const clave = String(f.get('password') || '')
    if (!error && clave) {
      if (clave.length < 8) errClave = 'La contraseña debe tener al menos 8 caracteres.'
      else errClave = (await supabase.auth.updateUser({ password: clave })).error
    }
    setGuardando(false)
    if (error) return setError(error.message)
    if (errClave) return setError(typeof errClave === 'string' ? errClave : traducirError(errClave))
    setMsg('Datos guardados.')
    e.target.password.value = ''
    onGuardado()
  }

  return (
    <section className="cuenta-panel">
      <div className="cuenta-panel__head">
        <h2>Mis datos</h2>
        <button className="cuenta-link" onClick={() => setAbierto((v) => !v)}>{abierto ? 'Cerrar' : 'Editar'}</button>
      </div>
      {!abierto ? (
        <p className="cuenta-muted">{socio.nombre} · {socio.email}{socio.telefono ? ` · ${socio.telefono}` : ''}</p>
      ) : (
        <form className="cuenta-form" onSubmit={onSubmit}>
          <label>Nombre<input name="nombre" defaultValue={socio.nombre} maxLength={80} required /></label>
          <label>Teléfono<input name="telefono" type="tel" defaultValue={socio.telefono ?? ''} /></label>
          <label>Correo<input value={socio.email} disabled /></label>
          <label>Contraseña nueva (opcional)<input name="password" type="password" minLength={8} placeholder="Déjala vacía para no cambiarla" autoComplete="new-password" /></label>
          {error && <p className="admin-login__error">{error}</p>}
          {msg && <p className="cuenta-ok">{msg}</p>}
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </form>
      )}
    </section>
  )
}
