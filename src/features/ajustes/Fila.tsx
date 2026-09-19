import type { ReactNode } from 'react'

/** Campo dentro de una fila: más bajo y chico que el `input` suelto. */
export const CAMPO = 'min-h-[38px]! py-1.5! rounded-[10px]!'
/** Acción chica de una fila (badge-botón de 34 px). */
export const ACCION = 'hit inline-flex items-center justify-center gap-[5px] min-h-[34px] px-2.5 rounded-[9px] text-xs transition-colors disabled:opacity-40'

/** `apilar`: en el celular la etiqueta va arriba y el campo abajo a todo lo ancho. */
export function Fila({ label, hint, apilar, alta, children }: { label: string; hint?: string; apilar?: boolean; alta?: boolean; children: ReactNode }) {
  return (
    <div className={`flex justify-between gap-3 px-4 py-2.5 ${alta ? 'min-h-[68px]' : 'min-h-[60px]'} ${apilar ? 'flex-col items-stretch gap-2 sm:flex-row sm:items-center' : 'items-center'}`}>
      <div className="min-w-0"><p className="text-base font-medium text-ink">{label}</p>{hint && <p className="text-xs text-muted tabular-nums mt-0.5">{hint}</p>}</div>
      {children}
    </div>
  )
}
