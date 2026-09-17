import { useId, type ReactNode } from 'react'
import Icon from './Icon'

/**
 * Aviso ámbar con ícono y título (borradores sin cerrar, posibles
 * duplicados). Es una región con nombre: el lector la encuentra y la lee en
 * orden, sin interrumpir como un `alert`.
 */
export function AvisoAmbar({ titulo, children, className = '' }: { titulo: string; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={`rounded-[14px] bg-warn-tint border border-hairline px-4 py-3 flex items-start gap-3 ${className}`}>
      <span className="w-[30px] h-[30px] rounded-[9px] bg-warn/15 grid place-items-center shrink-0" aria-hidden="true">
        <Icon name="warning" className="w-4 h-4 text-warn" stroke={2} />
      </span>
      <div className="flex-1 min-w-0">
        <h2 id={id} className="text-sm font-semibold text-warn mt-1.5">{titulo}</h2>
        {children}
      </div>
    </section>
  )
}
