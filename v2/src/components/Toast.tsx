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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const hide = useCallback((id: number) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(({ message, tipo = 'info', actionLabel, onAction, duration = 4500 }: ShowOptions) => {
    const id = ++seq
    setToasts((prev) => [...prev.slice(-2), { id, message, tipo, actionLabel, onAction }])
    if (duration) timers.current[id] = setTimeout(() => hide(id), duration)
    return id
  }, [hide])

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])

  const value = useMemo<ToastApi>(() => ({
    show,
    hide,
    error: (message) => show({ message, tipo: 'error', duration: 7000 }),
    ok: (message) => show({ message, tipo: 'ok', duration: 3000 }),
  }), [show, hide])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="above-nav fixed inset-x-0 z-[60] px-4 pointer-events-none" style={{ bottom: 'calc(60px + max(8px, env(safe-area-inset-bottom)) + var(--sticky-bar-h, 0px))' }}>
        <div className="max-w-md mx-auto flex flex-col gap-2">
          {toasts.map((t) => <ToastView key={t.id} toast={t} onHide={() => hide(t.id)} />)}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onHide }: { toast: ToastItem; onHide: () => void }) {
  const color = toast.tipo === 'error' ? 'bg-neg text-white' : toast.tipo === 'ok' ? 'bg-pos text-white' : 'bg-ink text-canvas'
  return (
    <div role={toast.tipo === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 shadow-hero text-[13.5px] font-medium ${color}`}
      style={{ animation: 'toastUp .22s ease-out' }}>
      <span className="flex-1">{toast.message}</span>
      {toast.actionLabel && (
        <button onClick={() => { toast.onAction?.(); onHide() }} className="font-bold underline underline-offset-2">{toast.actionLabel}</button>
      )}
      <button onClick={onHide} aria-label="Cerrar aviso" className="opacity-80 hover:opacity-100">
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
