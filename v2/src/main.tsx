import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
// Fuentes alojadas en el repo: la PWA a veces está sin red y así no
// dependemos de Google Fonts ni del salto de `display=swap` remoto.
import '@fontsource/hanken-grotesk/latin-400.css'
import '@fontsource/hanken-grotesk/latin-500.css'
import '@fontsource/hanken-grotesk/latin-600.css'
import '@fontsource/hanken-grotesk/latin-700.css'
import '@fontsource/instrument-serif/latin-400.css'
import './styles.css'
import { router } from './router'
import { queryClient, persister, PERSIST_BUSTER } from './lib/query'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { aplicarTemaGuardado } from './lib/theme'

aplicarTemaGuardado()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, buster: PERSIST_BUSTER, maxAge: 1000 * 60 * 60 * 24 * 7 }}
      >
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
