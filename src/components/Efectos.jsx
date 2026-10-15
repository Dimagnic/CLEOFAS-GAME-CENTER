import { useEffect } from 'react'

// Efectos dinámicos de toda la página: aparición al hacer scroll, brillo que
// sigue al cursor, números que cuentan, barra de progreso y parallax.
const REVEAL = [
  '.eyebrow', '.stations__title', '.pricing__title', '.services__title', '.booking__title',
  '.contact__title', '.lugar__title', '.lugar__lead', '.lugar__datos', '.lugar__video',
  '.station-card', '.price-card', '.service-card', '.booking__card', '.contact__list',
  '.contact__mapa', '.footer__col', '.stations__note', '.pricing__foot',
].join(',')
const TARJETAS = '.station-card, .price-card, .service-card, .booking__card, .hero__panel'

export default function Efectos() {
  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const raiz = document.documentElement
    if (reducido) return undefined
    raiz.classList.add('js-fx')

    // 1) aparición escalonada
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.setAttribute('data-in', '1')
        io.unobserve(e.target)
        if (e.target.matches('.lugar__datos')) contar(e.target)
        if (e.target.matches('.eyebrow')) descifrar(e.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })

    const vistos = new WeakSet()
    const marcar = () => {
      document.querySelectorAll(REVEAL).forEach((el, i) => {
        if (vistos.has(el)) return
        vistos.add(el)
        el.setAttribute('data-fx', '1')
        const hermanos = el.parentElement ? [...el.parentElement.children].indexOf(el) : i
        el.style.setProperty('--d', `${Math.min(hermanos, 8) * 70}ms`)
        io.observe(el)
      })
    }
    marcar()
    // las tarjetas de estaciones llegan después de cargar datos
    const mo = new MutationObserver(marcar)
    mo.observe(document.body, { childList: true, subtree: true })

    // texto que se "descifra" como terminal
    function descifrar(el) {
      const fin = el.textContent
      const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>'
      const t0 = performance.now()
      const paso = (t) => {
        const k = Math.min((t - t0) / 700, 1)
        el.textContent = [...fin].map((ch, j) => (ch === ' ' || j < k * fin.length ? ch : abc[Math.floor(Math.random() * abc.length)])).join('')
        if (k < 1) requestAnimationFrame(paso); else el.textContent = fin
      }
      requestAnimationFrame(paso)
    }

    // 2) contador de números
    function contar(ul) {
      ul.querySelectorAll('strong').forEach((n) => {
        const fin = parseInt(n.textContent, 10)
        if (!fin) return
        const t0 = performance.now()
        const paso = (t) => {
          const k = Math.min((t - t0) / 1400, 1)
          n.textContent = Math.round(fin * (1 - Math.pow(1 - k, 3)))
          if (k < 1) requestAnimationFrame(paso)
        }
        requestAnimationFrame(paso)
      })
    }

    // 3) brillo que sigue al cursor + inclinación suave
    const mover = (ev) => {
      const t = ev.target.closest && ev.target.closest(TARJETAS)
      if (!t) return
      const r = t.getBoundingClientRect()
      const x = ev.clientX - r.left
      const y = ev.clientY - r.top
      t.style.setProperty('--mx', `${x}px`)
      t.style.setProperty('--my', `${y}px`)
      if (t.matches('.station-card, .price-card, .service-card')) {
        t.style.setProperty('--rx', `${((y / r.height) - 0.5) * -6}deg`)
        t.style.setProperty('--ry', `${((x / r.width) - 0.5) * 6}deg`)
      }
    }
    const salir = (ev) => {
      const t = ev.target.closest && ev.target.closest(TARJETAS)
      if (t) { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg') }
    }
    document.addEventListener('pointermove', mover, { passive: true })
    document.addEventListener('pointerout', salir, { passive: true })

    // foco de luz que sigue al cursor por toda la página
    const foco = document.createElement('div')
    foco.className = 'fx-foco'
    document.body.appendChild(foco)
    const sigue = (ev) => { foco.style.transform = `translate(${ev.clientX - 200}px, ${ev.clientY - 200}px)` }
    window.addEventListener('pointermove', sigue, { passive: true })

    // 4) barra de progreso y parallax del aro
    const barra = document.createElement('div')
    barra.className = 'fx-progreso'
    document.body.appendChild(barra)
    const scroll = () => {
      const h = raiz.scrollHeight - window.innerHeight
      barra.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`
      raiz.style.setProperty('--sy', `${window.scrollY}`)
    }
    window.addEventListener('scroll', scroll, { passive: true })
    scroll()

    return () => {
      io.disconnect(); mo.disconnect()
      document.removeEventListener('pointermove', mover)
      document.removeEventListener('pointerout', salir)
      window.removeEventListener('scroll', scroll)
      barra.remove()
      foco.remove()
      window.removeEventListener('pointermove', sigue)
      raiz.classList.remove('js-fx')
    }
  }, [])
  return null
}
