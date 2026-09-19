import { colorMetodo } from '@/lib/theme'

/** Proporción de cada método de pago en una barra apilada (Hoy y Análisis). Decorativa: los montos van en la lista. */
export function BarraMetodos({ metodos, className = '' }: { metodos: { key: string; color: string | null; monto: number }[]; className?: string }) {
  if (!metodos.length) return null
  return (
    <div className={`flex h-1.5 gap-0.5 rounded-full overflow-hidden ${className}`} aria-hidden="true">
      {metodos.map((m) => <span key={m.key} className="rounded-full min-w-[3px]" style={{ flex: `${m.monto} 1 0`, background: colorMetodo(m.color) }} />)}
    </div>
  )
}
