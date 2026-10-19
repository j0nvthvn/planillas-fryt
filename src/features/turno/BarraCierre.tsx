import { useLayoutEffect, useRef } from 'react'
import { clp } from '@/lib/format'

const TONO = { pos: 'bg-pos', warn: 'bg-warn', neg: 'bg-neg' } as const

/**
 * Barra fija del cierre: el neto, el estado del guardado y el botón que
 * abre la revisión. Publica su altura en `--sticky-bar-h` mientras existe,
 * para que los toasts y la etiqueta de staging queden encima.
 */
export function BarraCierre({ etiquetaNeto, neto, guardado, guardando, etiquetaBoton, onCerrar }: {
  etiquetaNeto: string
  neto: number
  guardado: { texto: string; tono: keyof typeof TONO } | null
  guardando: boolean
  etiquetaBoton: string
  onCerrar: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--sticky-bar-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--sticky-bar-h') }
  }, [])

  return (
    <div ref={ref} className="fixed inset-x-0 above-nav z-30 bg-card border-t border-hairline px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] md:pb-3.5 shadow-bar md:left-(--sidebar-w)">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="eyebrow leading-none mb-[5px]">{etiquetaNeto}</p>
          <p className={`amount text-amount-sm leading-none truncate ${neto >= 0 ? 'text-ink' : 'text-neg'}`}>{clp(neto)}</p>
          {/* Región viva estable: el lector se entera de «Borrador sincronizado» sin mirar. */}
          <div role="status">
            {guardado && (
              <p className="flex items-center gap-[5px] text-xs text-muted mt-[5px]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONO[guardado.tono]}`} aria-hidden="true" />{guardado.texto}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={onCerrar} disabled={guardando} className="btn-primary min-h-[50px] rounded-[13px] px-[22px] text-base min-w-[132px] shrink-0">
          {guardando ? 'Guardando…' : etiquetaBoton}
        </button>
      </div>
    </div>
  )
}
