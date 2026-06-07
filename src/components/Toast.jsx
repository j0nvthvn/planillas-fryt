import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const hide = useCallback(() => {
    clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  /** show({ message, actionLabel?, onAction?, duration? }) */
  const show = useCallback(({ message, actionLabel, onAction, duration = 5000 }) => {
    clearTimeout(timerRef.current)
    setToast({ id: Date.now(), message, actionLabel, onAction })
    if (duration) timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} onHide={hide} />}
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onHide }) {
  function handleAction() {
    toast.onAction?.()
    onHide()
  }
  return (
    <div className="above-nav fixed inset-x-0 z-50 px-4 pointer-events-none">
      <div
        role="status"
        className="max-w-md mx-auto mb-3 pointer-events-auto flex items-center gap-3 rounded-2xl bg-gray-900 dark:bg-zinc-700 text-white shadow-2xl px-4 py-3"
        style={{ animation: 'toastUp .26s cubic-bezier(.2,.8,.2,1)' }}
      >
        <style>{`@keyframes toastUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <span className="flex-1 text-sm font-medium">{toast.message}</span>
        {toast.actionLabel && (
          <button onClick={handleAction}
            className="shrink-0 text-sm font-bold text-amber-300 hover:text-amber-200 active:scale-95 transition-transform">
            {toast.actionLabel}
          </button>
        )}
        <button onClick={onHide} aria-label="Cerrar" className="shrink-0 text-white/50 hover:text-white">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
