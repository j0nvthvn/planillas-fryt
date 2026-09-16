import { lazy, Suspense } from 'react'
import { createRootRoute, createRoute, createRouter, redirect, Outlet, Navigate } from '@tanstack/react-router'
import { z } from 'zod'
import { esperarSesion, cargarUsuario } from './lib/auth'
import Layout from './components/Layout'
import Spinner from './components/Spinner'
import Login from './features/auth/Login'
import Hoy from './features/hoy/Hoy'
import CerrarTurno from './features/turno/CerrarTurno'

const Planilla = lazy(() => import('./features/planilla/Planilla'))
const Historial = lazy(() => import('./features/historial/Historial'))
const Analisis = lazy(() => import('./features/analisis/Analisis'))
const Proveedores = lazy(() => import('./features/proveedores/Proveedores'))
const ProveedorDetalle = lazy(() => import('./features/proveedores/ProveedorDetalle'))
const Ajustes = lazy(() => import('./features/ajustes/Ajustes'))

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const modoSchema = z.enum(['completo', 'mañana', 'tarde'])

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <Navigate to="/hoy" />,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    if (await esperarSesion()) throw redirect({ to: '/hoy' })
  },
  component: Login,
})

/** Todo lo que requiere sesión cuelga de acá (y comparte el Layout). */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ location }) => {
    const session = await esperarSesion()
    if (!session) throw redirect({ to: '/login', search: { volver: location.pathname } as never })
    const usuario = await cargarUsuario(session.user.id).catch(() => null)
    return { usuario, esDueno: usuario?.rol === 'dueño' }
  },
  component: () => (
    <Layout>
      <Suspense fallback={<Spinner />}>
        <Outlet />
      </Suspense>
    </Layout>
  ),
})

/** Rutas solo para la dueña: el local ve Hoy y Cerrar turno. */
const soloDueno = ({ context }: { context: { esDueno: boolean } }) => {
  if (!context.esDueno) throw redirect({ to: '/hoy' })
}

const indexRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: () => <Navigate to="/hoy" /> })
const hoyRoute = createRoute({ getParentRoute: () => appRoute, path: '/hoy', component: Hoy })

const turnoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/turno',
  validateSearch: z.object({ fecha: fechaSchema.optional(), modo: modoSchema.optional() }),
  component: CerrarTurno,
})

const diaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dia',
  validateSearch: z.object({ fecha: fechaSchema }),
  component: Planilla,
})

const historialRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/historial',
  beforeLoad: soloDueno,
  validateSearch: z.object({ filtro: z.enum(['todos', 'borradores', 'corregidos', 'descuadres', 'parciales']).optional() }),
  component: Historial,
})

const analisisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/analisis',
  beforeLoad: soloDueno,
  validateSearch: z.object({ desde: fechaSchema.optional(), hasta: fechaSchema.optional() }),
  component: Analisis,
})

const proveedoresRoute = createRoute({ getParentRoute: () => appRoute, path: '/proveedores', beforeLoad: soloDueno, component: Proveedores })
const proveedorRoute = createRoute({ getParentRoute: () => appRoute, path: '/proveedores/$id', beforeLoad: soloDueno, component: ProveedorDetalle })

const ajustesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ajustes',
  beforeLoad: soloDueno,
  validateSearch: z.object({ seccion: z.enum(['general', 'trabajadores', 'metodos', 'papelera', 'usuarios', 'errores']).optional() }),
  component: Ajustes,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([indexRoute, hoyRoute, turnoRoute, diaRoute, historialRoute, analisisRoute, proveedoresRoute, proveedorRoute, ajustesRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultPendingComponent: Spinner,
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
