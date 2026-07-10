import { Component } from 'react'
import { logError } from '../utils/errorLog'

/**
 * Red de seguridad ante errores de render que de otro modo dejarían una
 * pantalla en blanco sin ninguna pista de qué pasó. Registra el error en
 * logs_error (mismo mecanismo que useErrorToast) y muestra una pantalla
 * de recuperación en vez del blanco total.
 */
export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logError(error?.message || 'Error inesperado en la interfaz', {
      contexto: 'ErrorBoundary',
      detalle: { stack: error?.stack, componentStack: info?.componentStack },
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-neg-tint grid place-items-center mx-auto">
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-neg" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4l8 15H4l8-15zM12 9v4M12 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-[24px] text-ink">Algo salió mal</h1>
              <p className="text-sm text-muted mt-1">
                Ocurrió un error inesperado. Ya quedó registrado — intenta recargar la página.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary w-full py-3 text-base"
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
