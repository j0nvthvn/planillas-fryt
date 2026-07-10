import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logError } from './utils/errorLog'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

// Errores que no pasaron por ningún try/catch de la app (JS roto, promesa
// sin .catch) — se registran igual que los que sí se manejan, para que no
// quede un agujero ciego en el registro.
window.addEventListener('error', (e) => {
  logError(e.message || 'Error de script no capturado', {
    contexto: 'window.onerror',
    detalle: { filename: e.filename, lineno: e.lineno, stack: e.error?.stack },
  })
})
window.addEventListener('unhandledrejection', (e) => {
  logError(e.reason?.message || String(e.reason) || 'Promesa rechazada sin manejar', {
    contexto: 'unhandledrejection',
    detalle: { stack: e.reason?.stack },
  })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
