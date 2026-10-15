import { horarioHoyTexto } from '../data/negocio'

export default function Lugar() {
  return (
    <section className="section lugar">
      <div className="wrap lugar__grid">
        <div className="lugar__video hud-video">
          <video
            src="/video/cleofas-home.mp4"
            poster="/video/cleofas-home.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Así se vive Cleofas Game Center"
          />
          <span className="lugar__rec"><i />CLEOFAS · PUEBLA</span>
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
