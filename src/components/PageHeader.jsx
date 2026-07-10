import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import AvatarMenu from './AvatarMenu'

/**
 * `action` es un botón opcional (agregar, eliminar, etc.) que se
 * renderiza junto al avatar, dentro del mismo cluster que PageHeader
 * ya alinea a la derecha. Antes cada pantalla que necesitaba un botón
 * extra envolvía <PageHeader> en su propio flex externo — pero
 * PageHeader no sabía que debía cederle espacio, así que el avatar
 * quedaba apretado contra el título en vez de pegado al borde. Con
 * `action`, PageHeader sigue siendo el único responsable de todo el
 * lado derecho de la cabecera en cualquier pantalla.
 */
export default function PageHeader({ eyebrow, title, date, action, children }) {
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

      <div className="flex items-start gap-2 shrink-0">
        {action}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Cuenta de ${usuario?.nombre ?? 'usuario'}`}
          aria-expanded={menuOpen}
          className="shrink-0 w-[42px] h-[42px] rounded-full bg-brand text-white text-[15px] font-bold grid place-items-center focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
        >
          {inicial}
        </button>
      </div>

      <AvatarMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
