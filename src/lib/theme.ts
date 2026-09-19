import { useEffect, useState } from 'react'

export type Tema = 'sistema' | 'claro' | 'oscuro'
const KEY = 'tema'

function leer(): Tema {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'claro' || t === 'oscuro' ? t : 'sistema'
  } catch { return 'sistema' }
}

function aplicar(t: Tema) {
  const oscuro = t === 'oscuro' || (t === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', oscuro)
}

export function aplicarTemaGuardado() {
  aplicar(leer())
}

export function useTema() {
  const [tema, setTemaState] = useState<Tema>(leer)
  useEffect(() => {
    aplicar(tema)
    try { localStorage.setItem(KEY, tema) } catch { /* sin storage */ }
    if (tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => aplicar('sistema')
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [tema])
  return { tema, setTema: setTemaState }
}

/**
 * Color de un método de pago (viene de la base) apto para el tema actual:
 * en oscuro se aclara mezclándolo con blanco (`--metodo-mezcla` en styles.css).
 */
export function colorMetodo(color: string | null | undefined): string | undefined {
  return color ? `color-mix(in oklab, ${color} var(--metodo-mezcla), white)` : undefined
}
