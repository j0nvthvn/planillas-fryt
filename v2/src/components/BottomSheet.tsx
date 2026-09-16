import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

interface Props {
  title?: string
  children: ReactNode
  onClose: () => void
  extra?: ReactNode
  /** Acciones que quedan siempre a la vista bajo el contenido desplazable. */
  footer?: ReactNode
}

/**
 * Hoja inferior en móvil (arrastrable hacia abajo para cerrar), diálogo
 * centrado en escritorio. Es un `<dialog>` nativo abierto con `showModal()`:
 * el foco entra al abrir, queda atrapado adentro, vuelve al botón que la
 * abrió al cerrar y Escape funciona solo. Bloquea además el scroll del
 * fondo, que iOS no detiene por su cuenta. Solo el cuerpo se desplaza: el
 * título y el pie (`footer`) quedan fijos aunque la pantalla sea baja.
 */
export function BottomSheet({ title, children, onClose, extra, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const startY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  // Antes del primer pintado: si no, la hoja se vería un frame fuera del
  // top layer. Al desmontar, `close()` devuelve el foco a quien abrió.
  useLayoutEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => { if (d?.open) d.close() }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const h = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      // Escape: lo maneja React desmontando la hoja, no el diálogo.
      onCancel={(e) => { e.preventDefault(); onClose() }}
      // Clic en el fondo oscuro: el destino del evento es el propio <dialog>.
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="fixed inset-x-0 bottom-0 top-auto z-50 m-0 w-full max-w-none p-0 border-0 bg-canvas text-ink rounded-t-[30px] px-5 pt-3 max-h-[92dvh] overflow-hidden flex flex-col gap-3 safe-bottom backdrop:bg-black/35 dark:backdrop:bg-black/60 md:inset-x-auto md:left-1/2 md:bottom-auto md:top-[8vh] md:w-[480px] md:rounded-3xl md:max-h-[84vh]"
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
      <div data-handle className="md:hidden w-full flex justify-center pt-1 pb-2 cursor-grab touch-none no-select">
        <div className="w-10 h-1 rounded-full bg-hairline" />
      </div>
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <div className="flex gap-2">
            {extra}
            <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center bg-hairline text-ink2" aria-label="Cerrar">
              <Icon name="close" className="w-4 h-4" stroke={2.2} />
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto overscroll-contain -mx-5 px-5 -mt-1 pt-1 pb-1">
        {children}
      </div>
      {footer && <div className="shrink-0 flex flex-col gap-2 -mx-5 px-5 pt-3 border-t border-hairline">{footer}</div>}
    </dialog>
  )
}
