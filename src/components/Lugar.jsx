import { useState } from 'react'
import { horarioHoyTexto } from '../data/negocio'
import { VIDEOS } from '../data/videos'

export default function Lugar() {
  const [i, setI] = useState(0)
  const v = VIDEOS[i]
  return (
    <section className="section lugar">
      <div className="wrap lugar__grid">
        <div className="lugar__video hud-video">
          <video
            key={v.src}
            src={v.src}
            poster={v.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Así se vive Cleofas Game Center"
          />
          <span className="lugar__rec"><i />CLEOFAS · {v.titulo.toUpperCase()}</span>
          {VIDEOS.length > 1 && (
            <div className="lugar__tabs">
              {VIDEOS.map((x, k) => (
                <button key={x.src} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={x.titulo} />
              ))}
            </div>
          )}
        </div>

        <div className="lugar__copy">
          <p className="eyebrow">Así se vive</p>
          <h2 className="lugar__title">Entra al <span className="hl">modo juego</span></h2>
          <p className="lugar__lead">
            Luces neón, PC con RTX, monitores de hasta 500 Hz y consolas Xbox listas
            para jugar con tus amigos. Reserva tu estación por hora y llega a sentarte.
          </p>
          <ul className="lugar__datos">
            <li><strong>5</strong><span>PC gamer</span></li>
            <li><strong>6</strong><span>Consolas Xbox</span></li>
            <li><strong>500</strong><span>Hz de monitor máx.</span></li>
          </ul>
          <p className="lugar__hoy">Hoy abierto {horarioHoyTexto()}</p>
          <div className="hero__actions">
            <a href="#reservar" className="btn btn-primary">Reservar ahora</a>
            <a href="#contacto" className="btn btn-ghost">Cómo llegar</a>
          </div>
        </div>
      </div>
    </section>
  )
}
