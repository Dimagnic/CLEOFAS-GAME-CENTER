import { useEffect, useRef, useState } from 'react'
import { iniciarCamara, motorCamara } from '../../lib/hardware'

// Ventana con la cámara para leer un QR o código de barras. Se cierra sola al leer.
export default function EscanerCamara({ titulo = 'Escanear con la cámara', onCodigo, onCerrar }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let detener = () => {}
    let leido = false
    iniciarCamara(video.current, (c) => {
      if (leido) return
      leido = true
      if (navigator.vibrate) navigator.vibrate(80)
      onCodigo(c)
    }, { onError: setError }).then((fn) => { detener = fn })
    return () => detener()
  }, [])
  return (
    <div className="admin-modal__backdrop" onClick={onCerrar}>
      <div className="admin-modal camara" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        {error ? <p className="admin-note admin-note--error">{error}</p> : (
          <div className="camara__marco"><video ref={video} muted playsInline /><i aria-hidden="true" /></div>
        )}
        <p className="socio-picker__nota">Lector: {motorCamara()}. Acerca el código al recuadro.</p>
        <div className="admin-modal__actions"><button className="btn btn-ghost btn-sm" onClick={onCerrar}>Cerrar</button></div>
      </div>
    </div>
  )
}
