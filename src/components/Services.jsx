import './Services.css'

const ICONOS = {'Torneos': '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Zm-3 1h3m10 0h3M12 14v4m-4 2h8"/>', 'Salas': '<rect x="3" y="5" width="18" height="11" rx="1"/><path d="M8 20h8M12 16v4"/>', 'Zona': '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', 'Café': '<path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Zm11 1h2a2 2 0 0 1 0 5h-2M8 3v2m4-2v2"/>'}

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
              <svg className="service-card__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONOS[s.titulo.split(' ')[0]] || ICONOS.Torneos }} />
              <h3>{s.titulo}</h3>
              <p>{s.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
