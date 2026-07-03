import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import AvatarMenu from './AvatarMenu'

export default function PageHeader({ eyebrow, title, date, children }) {
  const { usuario } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const inicial = usuario?.nombre?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="relative flex items-start justify-between gap-3 mb-5">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="eyebrow text-brand mb-1">{eyebrow}</p>
        )}
        {title && (
          <h1 className="font-display text-[30px] leading-none text-ink mb-1">{title}</h1>
        )}
        {date && (
          <p className="text-sm text-muted capitalize">{date}</p>
        )}
        {children}
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={`Cuenta de ${usuario?.nombre ?? 'usuario'}`}
        aria-expanded={menuOpen}
        className="shrink-0 w-[42px] h-[42px] rounded-full bg-brand text-white text-[15px] font-bold grid place-items-center focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
      >
        {inicial}
      </button>

      <AvatarMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
