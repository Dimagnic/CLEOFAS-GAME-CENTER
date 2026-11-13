import { useEffect, useRef, useState } from 'react'
import { buscarSocios } from '../../lib/socios'
import { supabaseReady } from '../../lib/supabaseClient'

const puedeEscanear = typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia

// Selector de socio para el mostrador: busca por nombre, correo, teléfono o código.
// Un lector de QR USB funciona solo: "escribe" el código en el buscador.
export default function SocioPicker({ value, onChange, tipoDescuento = 'horas' }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [escaneando, setEscaneando] = useState(false)

  useEffect(() => {
    if (value || texto.trim().length < 2) { setResultados([]); return undefined }
    let vivo = true
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await buscarSocios(texto)
        if (!vivo) return
        setError('')
        // Código exacto (lector QR) → se elige solo
        if (r.length === 1 && /^S-[A-Z0-9]{6}$/i.test(texto.trim().replace(/^CLEOFAS:/i, ''))) elegir(r[0])
        else setResultados(r)
      } catch (e) {
        if (vivo) setError(e.message)
      } finally {
        if (vivo) setBuscando(false)
      }
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [texto, value])

  function elegir(s) {
    onChange(s)
    setTexto('')
    setResultados([])
  }

  if (!supabaseReady) return <p className="socio-picker__nota">Los socios requieren Supabase conectado.</p>

  if (value) {
    const r = value.rangos
    const pct = tipoDescuento === 'snacks' ? r?.desc_snacks : r?.desc_horas
    return (
      <div className="socio-picker__elegido" style={{ '--rango': r?.color || '#9FB0CC' }}>
        <div>
          <strong>{value.nombre || value.email}</strong>
          <span>{r?.nombre ?? 'Sin rango'} · {value.puntos} pts · {value.codigo}</span>
        </div>
        {pct > 0 && <em>-{pct}%</em>}
        <button type="button" onClick={() => onChange(null)} aria-label="Quitar socio">✕</button>
      </div>
    )
  }

  return (
    <div className="socio-picker">
      <div className="socio-picker__fila">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre, correo, teléfono o código S-XXXXXX"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (resultados[0]) elegir(resultados[0]) } }}
        />
        {puedeEscanear && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEscaneando(true)}>Escanear QR</button>}
      </div>
      {buscando && <p className="socio-picker__nota">Buscando…</p>}
      {error && <p className="socio-picker__nota socio-picker__nota--error">{error}</p>}
      {!buscando && texto.trim().length >= 2 && resultados.length === 0 && !error && <p className="socio-picker__nota">Sin resultados.</p>}
      {resultados.length > 0 && (
        <ul className="socio-picker__lista">
          {resultados.map((s) => (
            <li key={s.user_id}>
              <button type="button" onClick={() => elegir(s)} style={{ '--rango': s.rangos?.color || '#9FB0CC' }}>
                <strong>{s.nombre || s.email}</strong>
                <span>{s.rangos?.nombre} · {s.email}{s.telefono ? ` · ${s.telefono}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {escaneando && <Escaner onCodigo={(c) => { setEscaneando(false); setTexto(c) }} onCerrar={() => setEscaneando(false)} />}
    </div>
  )
}

function Escaner({ onCodigo, onCerrar }) {
  const video = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stream, timer, vivo = true
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s
        if (!vivo) return
        video.current.srcObject = s
        video.current.play()
        timer = setInterval(async () => {
          try {
            const [c] = await detector.detect(video.current)
            if (c?.rawValue && vivo) onCodigo(c.rawValue.trim())
          } catch { /* cuadro aún no listo */ }
        }, 300)
      })
      .catch(() => setError('No se pudo abrir la cámara. Revisa los permisos del navegador.'))
    return () => { vivo = false; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  return (
    <div className="socio-picker__scan">
      {error ? <p className="socio-picker__nota socio-picker__nota--error">{error}</p> : <video ref={video} muted playsInline />}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar}>Cancelar</button>
    </div>
  )
}
