import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '@/lib/errorLog'

const RELOAD_FLAG = 'frytcontrol:reload-por-chunk'

function esChunkViejo(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)
}

/** Tras un deploy, los chunks viejos ya no existen: se recarga una sola vez. */
function intentarRecargaAutomatica(error: unknown): boolean {
  if (!esChunkViejo(error)) return false
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch { return false }
  window.location.reload()
  return true
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() { return { hasError: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (intentarRecargaAutomatica(error)) return
    void logError(error.message || 'Error inesperado en la interfaz', {
      contexto: 'ErrorBoundary',
      detalle: { stack: error.stack, componentStack: info.componentStack },
    })
  }

  componentDidMount() {
    try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* sin storage */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-[16px] bg-neg-tint border border-hairline grid place-items-center mx-auto text-neg">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-7 h-7" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l8 15H4l8-15zM12 9v4M12 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Algo salió mal</h1>
            <p className="text-sm text-muted mt-1">Ya quedó registrado. Recarga la página para seguir.</p>
          </div>
          <button type="button" onClick={() => window.location.reload()} className="btn-primary w-full btn-lg">Recargar</button>
        </div>
      </div>
    )
  }
}
