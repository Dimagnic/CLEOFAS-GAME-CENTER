const ITEMS = [
  'RTX 5070 Ti', 'Monitores hasta 500 Hz', 'Xbox Series X', 'Reserva en línea', 'Pago seguro con Stripe',
  '5 PC gamer', '6 consolas Xbox', 'Centro histórico de Puebla', 'Juega con tus amigos',
]

export default function Ticker() {
  const fila = [...ITEMS, ...ITEMS]
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker__track">
        {fila.map((t, i) => <span key={i} className="ticker__item">{t}</span>)}
      </div>
    </div>
  )
}
