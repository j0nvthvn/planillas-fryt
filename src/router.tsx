import { lazy, Suspense, type ReactNode } from 'react'
import { createRootRoute, createRoute, createRouter, redirect, Outlet, Navigate, Link, SearchParamError } from '@tanstack/react-router'
import { z } from 'zod'
import { esperarSesion, cargarUsuario, useSession } from './lib/auth'
import Layout from './components/Layout'
import { EsqueletoContenido, EsqueletoPagina } from './components/Esqueleto'
import Login from './features/auth/Login'
import Hoy from './features/hoy/Hoy'
import CerrarTurno from './features/turno/CerrarTurno'
import { busquedaPlanilla } from './lib/fechaPlanilla'
import { busquedaAjustes, busquedaAnalisis, busquedaHistorial, busquedaProveedores } from './lib/busquedas'

const Planilla = lazy(() => import('./features/planilla/Planilla'))
const Historial = lazy(() => import('./features/historial/Historial'))
const Analisis = lazy(() => import('./features/analisis/Analisis'))
const Proveedores = lazy(() => import('./features/proveedores/Proveedores'))
const ProveedorDetalle = lazy(() => import('./features/proveedores/ProveedorDetalle'))
const Ajustes = lazy(() => import('./features/ajustes/Ajustes'))
const Reporte = lazy(() => import('./features/exportar/Reporte'))

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const modoSchema = z.enum(['completo', 'mañana', 'tarde'])

/**
 * Pantalla para un enlace con fecha o modo que no se entiende, donde no
 * conviene cambiarlo en silencio por otro (se abriría otro día). Los demás
 * errores siguen su camino.
 */
function errorDeEnlace(titulo: string, texto: string) {
  return function ErrorDeEnlace({ error }: { error: unknown }) {
    if (!(error instanceof SearchParamError)) throw error
    return (
      <section className="p-6 space-y-4" role="alert">
        <h1 className="text-xl font-semibold">{titulo}</h1>
        <p>{texto}</p>
        <Link to="/hoy" className="btn">Volver a Hoy</Link>
      </section>
    )
  }
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <Navigate to="/hoy" />,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: z.object({ volver: z.string().optional() }),
  beforeLoad: async () => {
    if (await esperarSesion()) throw redirect({ to: '/hoy' })
  },
  component: Login,
})

/**
 * beforeLoad solo corre al navegar: si la sesión se cierra (botón Salir,
 * token vencido, otra pestaña) con una pantalla abierta, esto la saca a /login.
 */
function RequiereSesion({ children }: { children: ReactNode }) {
  const session = useSession()
  if (session === null) return <Navigate to="/login" replace />
  return children
}

/** Todo lo que requiere sesión cuelga de acá (y comparte el Layout). */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ location }) => {
    const session = await esperarSesion()
    if (!session) throw redirect({ to: '/login', search: { volver: location.pathname } })
    const usuario = await cargarUsuario(session.user.id).catch(() => null)
    return { usuario, esDueno: usuario?.rol === 'dueño' }
  },
  component: () => (
    <RequiereSesion>
      <Layout>
        <Suspense fallback={<EsqueletoContenido />}>
          <Outlet />
        </Suspense>
      </Layout>
    </RequiereSesion>
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
  errorComponent: errorDeEnlace('Enlace inválido', 'No pudimos abrir el cierre de turno. Revisa la fecha del enlace o vuelve a Hoy.'),
  component: CerrarTurno,
})

const diaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dia',
  validateSearch: busquedaPlanilla,
  beforeLoad: ({ search, location }) => {
    if (!new URLSearchParams(location.searchStr).has('fecha')) {
      throw redirect({ to: '/dia', search: { fecha: search.fecha }, replace: true })
    }
  },
  errorComponent: errorDeEnlace('Fecha inválida', 'No pudimos abrir la planilla. Revisa la fecha del enlace o vuelve a Hoy.'),
  component: Planilla,
})

const historialRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/historial',
  beforeLoad: soloDueno,
  validateSearch: busquedaHistorial,
  component: Historial,
})

const analisisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/analisis',
  beforeLoad: soloDueno,
  validateSearch: busquedaAnalisis,
  component: Analisis,
})

const proveedoresRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/proveedores',
  beforeLoad: soloDueno,
  validateSearch: busquedaProveedores,
  component: Proveedores,
})
const proveedorRoute = createRoute({ getParentRoute: () => appRoute, path: '/proveedores/$id', beforeLoad: soloDueno, component: ProveedorDetalle })

const ajustesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ajustes',
  beforeLoad: soloDueno,
  validateSearch: busquedaAjustes,
  component: Ajustes,
})

/**
 * Reporte imprimible: fuera del Layout (sin navegación ni contenedor con
 * scroll, que cortaría la impresión), pero con la misma sesión y solo para
 * la dueña.
 */
const reporteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analisis/reporte',
  validateSearch: z.object({ desde: fechaSchema, hasta: fechaSchema }),
  errorComponent: errorDeEnlace('Enlace inválido', 'No pudimos armar el reporte. Revisa las fechas del enlace o vuelve a Hoy.'),
  beforeLoad: async ({ location }) => {
    const session = await esperarSesion()
    if (!session) throw redirect({ to: '/login', search: { volver: location.pathname } })
    const usuario = await cargarUsuario(session.user.id).catch(() => null)
    if (usuario?.rol !== 'dueño') throw redirect({ to: '/hoy' })
  },
  component: () => (
    <RequiereSesion>
      <Suspense fallback={<EsqueletoPagina />}>
        <Reporte />
      </Suspense>
    </RequiereSesion>
  ),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  reporteRoute,
  appRoute.addChildren([indexRoute, hoyRoute, turnoRoute, diaRoute, historialRoute, analisisRoute, proveedoresRoute, proveedorRoute, ajustesRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  // En el celular el scroll vive en `main`: una pantalla nueva parte arriba
  // y al volver recupera su posición.
  scrollToTopSelectors: ['#contenido'],
  defaultPendingComponent: EsqueletoPagina,
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
