import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './fonts.css'
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
