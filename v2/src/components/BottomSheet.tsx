import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

interface Props {
  title?: string
  children: ReactNode
  onClose: () => void
  extra?: ReactNode
}

/**
 * Hoja inferior en móvil (arrastrable hacia abajo para cerrar), diálogo
 * centrado en escritorio. Bloquea el scroll del fondo mientras está abierta.
 */
export function BottomSheet({ title, children, onClose, extra }: Props) {
  const startY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const h = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/35 dark:bg-black/60" style={{ animation: 'fadeIn .18s ease-out' }} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 bg-canvas rounded-t-[30px] px-5 pt-3 max-h-[92dvh] overflow-y-auto flex flex-col gap-3 safe-bottom md:inset-x-auto md:left-1/2 md:bottom-auto md:top-[8vh] md:w-[480px] md:rounded-3xl md:max-h-[84vh]"
        style={{
          animation: dragY === 0 ? 'sheetUp .26s cubic-bezier(.2,.8,.2,1)' : 'none',
          transform: isDesktop ? 'translateX(-50%)' : `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform .2s ease' : 'none',
          boxShadow: '0 -22px 55px -22px rgba(0,0,0,.45)',
        }}
        onPointerDown={(e) => {
          if (isDesktop) return
          if ((e.target as HTMLElement).closest('[data-handle]')) {
            startY.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }
        }}
        onPointerMove={(e) => { if (startY.current !== null) setDragY(Math.max(0, e.clientY - startY.current)) }}
        onPointerUp={() => { if (dragY > 80) onClose(); setDragY(0); startY.current = null }}
      >
        <div data-handle className="md:hidden w-full flex justify-center pt-1 pb-2 cursor-grab touch-none">
          <div className="w-10 h-1 rounded-full bg-hairline" />
        </div>
        {title && (
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-ink">{title}</h3>
            <div className="flex gap-2">
              {extra}
              <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center bg-hairline text-ink2" aria-label="Cerrar">
                <Icon name="close" className="w-4 h-4" stroke={2.2} />
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    </>
  )
}
