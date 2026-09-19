import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

interface ToastItem {
  id: number
  message: string
  tipo: 'info' | 'error' | 'ok'
  actionLabel?: string
  onAction?: () => void
}

interface ShowOptions {
  message: string
  tipo?: ToastItem['tipo']
  actionLabel?: string
  onAction?: () => void
  /** ms; null = persistente hasta que se cierre */
  duration?: number | null
}

interface ToastApi {
  show: (o: ShowOptions) => number
  hide: (id: number) => void
  error: (message: string) => number
  ok: (message: string) => number
}

const ToastContext = createContext<ToastApi | null>(null)
let seq = 0

const SOPORTA_POPOVER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const duraciones = useRef<Record<number, number>>({})

  const hide = useCallback((id: number) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    delete duraciones.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const programar = useCallback((id: number, duracion?: number) => {
    if (duracion) duraciones.current[id] = duracion
    const ms = duraciones.current[id]
    clearTimeout(timers.current[id])
    if (ms) timers.current[id] = setTimeout(() => hide(id), ms)
  }, [hide])

  // Mientras el dedo, el puntero o el foco están sobre el aviso no se va:
  // da tiempo a leerlo y a llegar a su acción (WCAG 2.2.1).
  const pausar = useCallback((id: number) => { clearTimeout(timers.current[id]) }, [])

  const show = useCallback(({ message, tipo = 'info', actionLabel, onAction, duration }: ShowOptions) => {
    const id = ++seq
    setToasts((prev) => [...prev.slice(-2), { id, message, tipo, actionLabel, onAction }])
    // Con acción («Deshacer», «Ver papelera») hace falta más tiempo para alcanzarla.
    const ms = duration === undefined ? (actionLabel ? 10000 : 4500) : duration
    if (ms) programar(id, ms)
    return id
  }, [programar])

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])

  // Las hojas son <dialog> y viven en el top layer: un aviso en un <div>
  // normal quedaría detrás. Con popover el contenedor también sube al top
  // layer, y se vuelve a mostrar con cada aviso para quedar por encima de
  // la hoja que esté abierta. Si el navegador no lo soporta, se ve igual
  // que antes (detrás de la hoja).
  const capa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = capa.current
    if (!el || toasts.length === 0 || !SOPORTA_POPOVER) return
    try { el.hidePopover() } catch { /* no estaba abierto */ }
    try { el.showPopover() } catch { /* sin soporte */ }
  }, [toasts])

  const value = useMemo<ToastApi>(() => ({
    show,
    hide,
    error: (message) => show({ message, tipo: 'error', duration: 7000 }),
    ok: (message) => show({ message, tipo: 'ok', duration: 3000 }),
  }), [show, hide])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div ref={capa} popover={SOPORTA_POPOVER ? 'manual' : undefined} className="above-nav fixed inset-x-0 inset-y-auto z-[60] w-full max-w-none m-0 p-0 px-4 border-0 bg-transparent overflow-visible pointer-events-none" style={{ display: 'block', bottom: 'calc(var(--nav-h) + var(--sticky-bar-h, 0px))' }}>
        {/* Región viva siempre montada: un aviso que aparece dentro de ella se
            anuncia; uno que se monta ya con su rol a veces no. */}
        <div className="max-w-md mx-auto flex flex-col gap-2" aria-live="polite" aria-relevant="additions">
          {toasts.map((t) => <ToastView key={t.id} toast={t} onHide={() => hide(t.id)} onPausa={() => pausar(t.id)} onSigue={() => programar(t.id)} />)}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onHide, onPausa, onSigue }: { toast: ToastItem; onHide: () => void; onPausa: () => void; onSigue: () => void }) {
  const color = toast.tipo === 'error' ? 'bg-neg text-on-solid' : toast.tipo === 'ok' ? 'bg-pos text-on-solid' : 'bg-ink text-canvas'
  return (
    <div role={toast.tipo === 'error' ? 'alert' : undefined}
      onPointerEnter={onPausa} onPointerLeave={onSigue} onFocus={onPausa} onBlur={onSigue}
      className={`pointer-events-auto flex items-center gap-3 rounded-[14px] px-4 py-3 shadow-hero text-sm font-medium ${color}`}
      style={{ animation: 'toastUp .22s ease-out' }}>
      <span className="flex-1">{toast.message}</span>
      {toast.actionLabel && (
        <button onClick={() => { toast.onAction?.(); onHide() }} className="hit shrink-0 font-semibold underline underline-offset-2">{toast.actionLabel}</button>
      )}
      <button type="button" onClick={onHide} aria-label="Cerrar aviso" className="hit shrink-0 -m-1 p-1 rounded-[8px]">
        <Icon name="close" className="w-4 h-4" stroke={2.2} />
      </button>
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
