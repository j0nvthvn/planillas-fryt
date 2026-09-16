import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import Icon from './Icon'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  /** Botón/es a la derecha del título. */
  action?: ReactNode
  /** Ruta del botón "volver" (flecha a la izquierda). */
  back?: string
  children?: ReactNode
}

export default function PageHeader({ eyebrow, title, subtitle, action, back, children }: Props) {
  return (
    <header className="flex items-start justify-between gap-3 mb-5">
      <div className="min-w-0 flex-1 flex items-start gap-2">
        {back && (
          <Link to={back} aria-label="Volver" className="mt-1 -ml-2 w-10 h-10 rounded-full grid place-items-center text-ink2 hover:bg-soft shrink-0">
            <Icon name="arrowLeft" className="w-5 h-5" stroke={2} />
          </Link>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow text-brand mb-1">{eyebrow}</p>}
          <h1 className="font-display text-amount-sm leading-none text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-muted capitalize mt-1">{subtitle}</p>}
          {children}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </header>
  )
}
