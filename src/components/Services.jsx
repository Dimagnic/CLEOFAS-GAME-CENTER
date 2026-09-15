import './Services.css'

const SERVICIOS = [
  {
    titulo: 'Torneos de sábado',
    texto: 'Valorant, FIFA y Fortnite por categorías. Inscríbete en el mostrador o al reservar tu estación.',
  },
  {
    titulo: 'Salas para grupos',
    texto: 'Junta hasta 4 estaciones para cumpleaños o noches con amigos, con un anfitrión asignado.',
  },
  {
    titulo: 'Zona infantil supervisada',
    texto: 'Estaciones con control de contenido y descansos guiados para menores de 12 años.',
  },
  {
    titulo: 'Café y snacks',
    texto: 'Pide desde tu lugar; el encargado lo lleva sin que pierdas tiempo de partida.',
  },
]

export default function Services() {
  return (
    <section className="section services">
      <div className="wrap">
        <p className="eyebrow">Más que una pantalla</p>
        <h2 className="services__title">Pensado para quedarse toda la tarde</h2>

        <div className="services__grid">
          {SERVICIOS.map((s) => (
            <article key={s.titulo} className="service-card">
              <h3>{s.titulo}</h3>
              <p>{s.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
