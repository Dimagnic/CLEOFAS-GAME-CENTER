import { useEffect, useRef } from 'react'

// Chispas de neón (rojo y cian) que cruzan el fondo de toda la página.
export default function Particulas() {
  const ref = useRef(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const c = ref.current
    const ctx = c.getContext('2d')
    let w = 0, h = 0, raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const n = window.innerWidth < 700 ? 22 : 46
    const mk = () => ({
      x: Math.random() * w, y: Math.random() * h,
      l: 30 + Math.random() * 90, v: 0.6 + Math.random() * 1.8,
      rojo: Math.random() < 0.7, a: 0.15 + Math.random() * 0.45,
    })
    let ps = []
    const size = () => {
      w = window.innerWidth; h = window.innerHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ps = Array.from({ length: n }, mk)
    }
    const dibuja = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of ps) {
        const col = p.rojo ? '255,42,42' : '46,196,255'
        const g = ctx.createLinearGradient(p.x, p.y, p.x - p.l, p.y + p.l * 0.35)
        g.addColorStop(0, `rgba(${col},${p.a})`)
        g.addColorStop(1, `rgba(${col},0)`)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l, p.y + p.l * 0.35); ctx.stroke()
        p.x += p.v * 2.2; p.y -= p.v * 0.77
        if (p.x - p.l > w || p.y < -p.l) { p.x = -p.l; p.y = Math.random() * h + 40 }
      }
      raf = requestAnimationFrame(dibuja)
    }
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(dibuja) }
    size(); dibuja()
    window.addEventListener('resize', size)
    document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return <canvas ref={ref} className="particulas" aria-hidden="true" />
}
