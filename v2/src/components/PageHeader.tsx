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

/**
 * En el celular es una barra superior blanca a todo el ancho (anula el
 * padding de `main`); desde `md`, con la barra lateral, un encabezado simple.
 */
export default function PageHeader({ eyebrow, title, subtitle, action, back, children }: Props) {
  return (
    <header className="flex items-center justify-between gap-3 -mx-4 sm:-mx-6 -mt-5 mb-4 px-4 sm:px-6 py-4 bg-card border-b border-hairline md:m-0 md:mb-5 md:p-0 md:bg-transparent md:border-0 md:items-end">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        {back && (
          <Link to={back} aria-label="Volver" className="-ml-1.5 w-9 h-9 rounded-[10px] grid place-items-center text-ink2 hover:bg-soft shrink-0">
            <Icon name="chevL" className="w-5 h-5" stroke={2} />
          </Link>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-[5px]">{eyebrow}</p>}
          <h1 className="font-display text-[20px] md:text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted mt-[3px]">{subtitle}</p>}
          {children}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </header>
  )
}
