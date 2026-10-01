import type { ReactNode } from 'react'
import { etiquetaEstado } from '@/features/turno/estado'

/** Cifra con su etiqueta, dentro de una fila de datos (Hoy y la planilla). */
export function Dato({ label, className = 'text-ink', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs leading-none text-muted mb-[5px]">{label}</p>
      <p className={`cifra text-sm min-[360px]:text-base leading-none truncate ${className}`}>{children}</p>
    </div>
  )
}

/** Estado del día: sin registro, borrador, parcial, completo o no abrió. */
export function EstadoChip({ estado }: { estado: string }) {
  const e = etiquetaEstado(estado)
  return <span className={`badge ${e.cls}`}>{e.chip}</span>
}
