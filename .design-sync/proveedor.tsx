// Contexto mínimo para las vistas previas: un router en memoria, porque
// PageHeader usa `Link`, `useRouter` y `useCanGoBack`. No es parte de la app;
// se agrega al bundle con cfg.extraEntries y se usa desde cfg.provider.
import type { ReactNode } from 'react'
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'

const rootRoute = createRootRoute()
const router = createRouter({
  routeTree: rootRoute,
  history: createMemoryHistory({ initialEntries: ['/'] }),
})

export function ProveedorPreview({ children }: { children: ReactNode }) {
  return <RouterContextProvider router={router}>{children}</RouterContextProvider>
}
