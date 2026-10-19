import { createContext, useContext } from 'react'

/**
 * Avisos breves (toasts): el contexto y el hook, aparte de `components/Toast`
 * para que ese archivo exporte solo componentes (Fast Refresh).
 */
export interface ToastItem {
  id: number
  message: string
  tipo: 'info' | 'error' | 'ok'
  actionLabel?: string
  onAction?: () => void
}

export interface ShowOptions {
  message: string
  tipo?: ToastItem['tipo']
  actionLabel?: string
  onAction?: () => void
  /** ms; null = persistente hasta que se cierre */
  duration?: number | null
}

export interface ToastApi {
  show: (o: ShowOptions) => number
  hide: (id: number) => void
  error: (message: string) => number
  ok: (message: string) => number
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
