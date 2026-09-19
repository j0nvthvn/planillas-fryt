import { useRef, type KeyboardEvent } from 'react'

/**
 * Grupo de radios hecho con botones (segmented, píldoras): una sola parada
 * de Tab para todo el grupo y las flechas cambian la opción, como un grupo
 * de radios nativo (WAI-ARIA «Radio Group»). Devuelve las props de cada
 * opción; el contenedor lleva `role="radiogroup"` y un nombre.
 */
export function useRovingRadio<T>(opciones: readonly T[], valor: T | null | undefined, onChange: (v: T) => void, deshabilitada?: (v: T) => boolean) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const habilitada = (i: number) => !deshabilitada?.(opciones[i] as T)
  const elegida = opciones.findIndex((o) => o === valor)
  const primera = opciones.findIndex((_, i) => habilitada(i))
  const conFoco = elegida >= 0 && habilitada(elegida) ? elegida : primera

  const mover = (desde: number, paso: 1 | -1) => {
    for (let k = 1; k <= opciones.length; k++) {
      const i = (desde + paso * k + opciones.length * k) % opciones.length
      if (habilitada(i)) return i
    }
    return desde
  }

  return (opcion: T, i: number) => ({
    ref: (el: HTMLElement | null) => { refs.current[i] = el },
    role: 'radio' as const,
    'aria-checked': opcion === valor,
    tabIndex: i === conFoco ? 0 : -1,
    onKeyDown: (e: KeyboardEvent) => {
      let destino: number | null = null
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') destino = mover(i, 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') destino = mover(i, -1)
      else if (e.key === 'Home') destino = mover(opciones.length - 1, 1)
      else if (e.key === 'End') destino = mover(0, -1)
      if (destino == null) return
      e.preventDefault()
      onChange(opciones[destino] as T)
      refs.current[destino]?.focus()
    },
  })
}
