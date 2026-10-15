import { VIDEOS } from '../data/videos'

// Video de fondo tenue y decorativo (se oculta con "reducir movimiento").
export default function FondoVideo({ indice = 0, posicion = '50% 50%' }) {
  const v = VIDEOS[indice % VIDEOS.length]
  return (
    <div className="fondo-video" aria-hidden="true">
      <video src={v.src} poster={v.poster} autoPlay muted loop playsInline preload="none" style={{ objectPosition: posicion }} />
    </div>
  )
}
