import { useState } from 'react'
import { METODOS, pesos } from '../../lib/ventas'

// Selector de método de pago con efectivo recibido / cambio y referencia (terminal o transferencia).
export function MetodoPago({ total, metodo, setMetodo, recibido, setRecibido, referencia, setReferencia }) {
  const cambio = recibido !== '' && Number(recibido) >= total ? Number(recibido) - total : null
  const sugeridos = [...new Set([total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, 200, 500].filter((x) => x >= total))].slice(0, 4)
  return (
    <div className="cobro">
      <div className="cobro__metodos">
        {['efectivo', 'terminal', 'qr'].map((m) => (
          <button type="button" key={m} className={metodo === m ? 'is-on' : ''} onClick={() => setMetodo(m)}>{METODOS[m].etiqueta}</button>
        ))}
      </div>
      {metodo === 'efectivo' && (
        <div className="cobro__efectivo">
          <label>Recibido
            <input type="number" min="0" step="1" inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder={String(total)} />
          </label>
          <div className="cobro__rapidos">
            {sugeridos.map((s) => <button type="button" key={s} onClick={() => setRecibido(String(s))}>{s === total ? 'Exacto' : pesos(s)}</button>)}
          </div>
          <p className={`cobro__cambio ${recibido !== '' && Number(recibido) < total ? 'is-falta' : ''}`}>
            {recibido === '' ? 'Cambio: —' : Number(recibido) < total ? `Faltan ${pesos(total - Number(recibido))}` : `Cambio: ${pesos(cambio)}`}
          </p>
        </div>
      )}
      {(metodo === 'terminal' || metodo === 'qr') && (
        <label className="cobro__ref">{metodo === 'terminal' ? 'Núm. de autorización del voucher (opcional)' : 'Referencia de la transferencia (opcional)'}
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={60} />
        </label>
      )}
    </div>
  )
}

export function useCobro(total) {
  const [metodo, setMetodo] = useState('efectivo')
  const [recibido, setRecibido] = useState('')
  const [referencia, setReferencia] = useState('')
  const valido = metodo !== 'efectivo' || recibido === '' || Number(recibido) >= total
  const reset = () => { setMetodo('efectivo'); setRecibido(''); setReferencia('') }
  return {
    props: { total, metodo, setMetodo, recibido, setRecibido, referencia, setReferencia },
    valido, reset,
    args: { metodo, recibido: metodo === 'efectivo' && recibido !== '' ? Number(recibido) : null, referencia: referencia.trim() || null },
  }
}
