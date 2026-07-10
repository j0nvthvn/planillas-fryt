import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

let _id = 0
const nextId = () => ++_id

const ANIM_CSS = `@keyframes toastUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const hide = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /** show({ message, actionLabel?, onAction?, duration? }) — duration: null = persistente */
  const show = useCallback(({ message, actionLabel, onAction, duration = 5000 }) => {
    const id = nextId()
    setToasts((prev) => [...prev, { id, message, actionLabel, onAction }])
    if (duration) {
      timersRef.current[id] = setTimeout(() => hide(id), duration)
    }
    return id
  }, [hide])

  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout)
  }, [])

  const value = useMemo(() => ({ show, hide }), [show, hide])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <style>{ANIM_CSS}</style>
      <div className="above-nav fixed inset-x-0 z-50 px-4 pointer-events-none">
        <div className="max-w-md mx-auto flex flex-col gap-2">
          {toasts.map((t) => (
            <ToastView key={t.id} toast={t} onHide={() => hide(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onHide }) {
  function handleAction() {
    toast.onAction?.()
    onHide()
  }
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-zinc-900 text-white shadow-2xl px-4 py-3"
      style={{ animation: 'toastUp .26s cubic-bezier(.2,.8,.2,1)' }}
    >
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      {toast.actionLabel && (
        <button
          onClick={handleAction}
          className="shrink-0 text-sm font-bold text-amber-300 hover:text-amber-200 active:scale-95 transition-transform"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        onClick={onHide}
        aria-label="Cerrar"
        className="shrink-0 text-white/50 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
