import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

interface Props {
  title?: string
  children: ReactNode
  onClose: () => void
  extra?: ReactNode
  /** Acciones que quedan siempre a la vista bajo el contenido desplazable. */
  footer?: ReactNode
  /** `alertdialog` para confirmaciones que interrumpen (ConfirmDialog). */
  role?: 'dialog' | 'alertdialog'
  /** id del texto que describe el diálogo (`aria-describedby`). */
  describedBy?: string
}

/**
 * Hoja inferior en móvil (arrastrable hacia abajo para cerrar), diálogo
 * centrado en escritorio. Es un `<dialog>` nativo abierto con `showModal()`:
 * el foco entra al abrir, queda atrapado adentro, vuelve al botón que la
 * abrió al cerrar y Escape funciona solo. Bloquea además el scroll del
 * fondo, que iOS no detiene por su cuenta. Solo el cuerpo se desplaza: el
 * título y el pie (`footer`) quedan fijos aunque la pantalla sea baja.
 */
export function BottomSheet({ title, children, onClose, extra, footer, role, describedBy }: Props) {
  const tituloId = useId()
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
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={title ? tituloId : undefined}
      aria-describedby={describedBy}
      // Escape: lo maneja React desmontando la hoja, no el diálogo.
      onCancel={(e) => { e.preventDefault(); onClose() }}
      // Clic en el fondo oscuro: el destino del evento es el propio <dialog>.
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="fixed inset-x-0 bottom-0 top-auto z-50 m-0 w-full max-w-none border-0 border-t border-hairline bg-card text-ink rounded-t-[28px] px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))] max-h-[92dvh] overflow-hidden flex flex-col gap-3 backdrop:bg-black/[.38] md:inset-x-auto md:left-1/2 md:bottom-auto md:top-[8vh] md:w-[480px] md:rounded-[16px] md:border md:max-h-[84vh]"
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
        <div className="w-10 h-1 rounded-full bg-hairline-strong" aria-hidden="true" />
      </div>
      {title && (
        <div className="flex items-center justify-between gap-2.5">
          <h2 id={tituloId} className="font-display text-lg font-semibold tracking-[-0.015em] text-ink">{title}</h2>
          <div className="flex items-center gap-2.5">
            {extra}
            <button type="button" onClick={onClose} className="hit w-[34px] h-[34px] rounded-[10px] grid place-items-center bg-soft text-ink2 hover:bg-hairline-strong" aria-label="Cerrar">
              <Icon name="close" className="w-[15px] h-[15px]" stroke={2.2} />
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
