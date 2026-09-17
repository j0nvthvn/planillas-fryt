import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Icon, { type IconName } from './Icon'
import { useOnline } from '@/hooks/useOnline'
import { useUsuario } from '@/hooks/useUsuario'
import { useColorBarra } from '@/hooks/useColorBarra'
import { iniciales } from '@/lib/format'

interface Item { to: string; label: string; icon: IconName; dueno?: boolean }

const ITEMS: Item[] = [
  { to: '/hoy', label: 'Hoy', icon: 'home' },
  { to: '/turno', label: 'Cerrar turno', icon: 'plus' },
  { to: '/historial', label: 'Historial', icon: 'history', dueno: true },
  { to: '/analisis', label: 'Análisis', icon: 'chart', dueno: true },
  { to: '/proveedores', label: 'Proveedores', icon: 'suppliers', dueno: true },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings', dueno: true },
]
/** En la barra móvil: 2 a la izquierda, botón flotante, 2 a la derecha. */
const TABS_MOVIL_DUENO = ['/hoy', '/historial', '/analisis', '/ajustes']
const TABS_MOVIL_LOCAL = ['/hoy']

/** Título de la pestaña por pantalla (WCAG 2.4.2); el lector lo anuncia al navegar. */
function tituloDe(pathname: string): string {
  if (pathname.startsWith('/proveedores/')) return 'Proveedor'
  if (pathname === '/dia') return 'Planilla del día'
  return ITEMS.find((i) => activo(pathname, i.to))?.label ?? 'FrytControl'
}

function activo(pathname: string, to: string) {
  return to === '/hoy' ? pathname === '/hoy' || pathname === '/' : pathname === to || pathname.startsWith(to + '/')
}

/** `page` solo en la pantalla misma; en la sección que la contiene, `true`. */
function ariaActual(on: boolean, pathname: string, to: string): 'page' | true | undefined {
  if (!on) return undefined
  return activo(pathname, to) ? 'page' : true
}

/** Pestaña que se marca: la Planilla del día cuelga del Historial (o de Hoy, en el local). */
function seccion(pathname: string, esDueno: boolean) {
  return pathname === '/dia' ? (esDueno ? '/historial' : '/hoy') : pathname
}

function ActualizacionBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  // El contenedor queda montado para que el aviso se anuncie al aparecer.
  return (
    <div aria-live="polite" className="shrink-0 z-30">
      {needRefresh && (
        <div className="flex items-center justify-between gap-3 bg-info text-on-solid text-sm font-semibold px-4 py-2">
          <span>Hay una versión nueva de FrytControl.</span>
          <button type="button" onClick={() => void updateServiceWorker(true)} className="hit shrink-0 rounded-[10px] bg-on-solid/20 px-3 py-1.5 font-bold">Actualizar</button>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { usuario, esDueno } = useUsuario()
  const online = useOnline()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const marcada = seccion(pathname, esDueno)
  // Barra de estado: la tapa `franja-barra` y el `theme-color` la sigue; el color
  // por pantalla lo pone la banda de Hoy y Ajustes (ver `lib/barraEstado`).
  useColorBarra()
  const items = ITEMS.filter((i) => !i.dueno || esDueno)
  const tabsMovil = items.filter((i) => (esDueno ? TABS_MOVIL_DUENO : TABS_MOVIL_LOCAL).includes(i.to))
  const mitad = Math.ceil(tabsMovil.length / 2)
  const izq = tabsMovil.slice(0, mitad)
  const der = tabsMovil.slice(mitad)
  const fab = items.find((i) => i.to === '/turno')!
  // Cerrar turno es una tarea con principio y fin: en el celular va sin barra
  // inferior (se sale con la flecha del encabezado) y gana alto para el cierre.
  const enfoque = activo(pathname, fab.to)

  // Al cambiar de pantalla: título de la pestaña y foco al contenido, para
  // que el teclado y el lector de pantalla no se queden en el enlace que ya
  // no existe.
  const mainRef = useRef<HTMLElement>(null)
  const rutaAnterior = useRef(pathname)
  useEffect(() => {
    document.title = `${tituloDe(pathname)} · FrytControl`
    if (rutaAnterior.current === pathname) return
    rutaAnterior.current = pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="app-shell flex flex-col bg-canvas" data-sin-nav={enfoque || undefined}>
      <div className="franja-barra" aria-hidden="true" />
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-[10px] focus:bg-card focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-brand focus:shadow-hero">
        Saltar al contenido
      </a>
      <ActualizacionBanner />
      <div role="status" className="shrink-0 z-30">
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warn text-on-solid text-xs font-semibold px-3 py-2 text-center">
            <span className="w-1.5 h-1.5 rounded-full bg-on-solid animate-pulse shrink-0" aria-hidden="true" />
            Sin conexión: se guarda en este dispositivo y se reintenta al volver
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 max-w-screen-2xl mx-auto w-full overflow-hidden md:overflow-visible">
        <aside className="hidden md:flex flex-col w-(--sidebar-w) shrink-0 border-r border-hairline bg-card sticky top-0 h-screen overflow-y-auto">
          <div className="flex items-center gap-2.5 px-5 pt-6 pb-4 mb-2 border-b border-hairline">
            <img src="/logo.jpg" alt="" width={32} height={32} className="w-8 h-8 rounded-full shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold tracking-[-0.01em] text-ink">FrytControl</p>
              <p className="text-xs text-muted mt-0.5">Minimarket Fryt</p>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 px-3 pb-4" aria-label="Navegación principal">
            {items.map((i) => {
              const on = activo(marcada, i.to)
              return (
                <Link key={i.to} to={i.to} aria-current={ariaActual(on, pathname, i.to)}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-[11px] py-[9px] text-md transition-colors ${on ? 'bg-brand-tint text-brand font-semibold' : 'text-ink2 font-medium hover:bg-soft hover:text-ink'}`}>
                  <Icon name={i.icon} className="w-5 h-5 shrink-0" stroke={on ? 2.1 : 1.8} />{i.label}
                </Link>
              )
            })}
          </nav>
          {/* Solo muestra quién está conectado; se cierra sesión en Ajustes (o en Hoy, la cuenta del local). */}
          <div className="flex items-center gap-3 mx-3 mb-4 border-t border-hairline px-[11px] pt-4">
            <span className="w-[34px] h-[34px] rounded-[10px] bg-soft border border-hairline text-ink2 text-md font-semibold grid place-items-center shrink-0" aria-hidden="true">{iniciales(usuario?.nombre)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink truncate">{usuario?.nombre ?? 'Cuenta'}</span>
              <span className="block text-xs text-muted truncate">{esDueno ? 'dueña' : 'cuenta del local'}</span>
            </span>
          </div>
        </aside>

        <main id="contenido" data-scroll-restoration-id="contenido" ref={mainRef} tabIndex={-1} className="focus:outline-none scroll-pt-[76px] md:scroll-pt-0 flex-1 min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-5 pb-nav md:pb-8 overflow-y-auto overflow-x-hidden md:overflow-visible">
          {children}
        </main>
      </div>

      {!enfoque && <nav aria-label="Navegación principal" className="md:hidden shrink-0 relative bg-card border-t border-hairline"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-stretch">
          <div className="flex-1 flex items-stretch">{izq.map((i) => <Tab key={i.to} item={i} on={activo(marcada, i.to)} actual={ariaActual(activo(marcada, i.to), pathname, i.to)} />)}</div>
          {/* Botón flotante con su etiqueta a la altura de las demás: el alto
              del ícono se reserva y el cuadro sube por encima de la barra. */}
          <Link to={fab.to} className="group relative w-[76px] shrink-0 flex flex-col items-center justify-center gap-1 pt-2.5 pb-0.5 min-h-[58px] text-[11px] text-muted font-medium">
            <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 -top-[28px] z-40 grid place-items-center w-[58px] h-[58px] rounded-[19px] border-[3px] border-card bg-brand text-on-solid shadow-fab group-hover:bg-brand-hover transition-colors">
              <Icon name="cash" className="w-6 h-6" stroke={2.3} />
            </span>
            <span className="h-[21px]" aria-hidden="true" />
            <span className="whitespace-nowrap">{fab.label}</span>
          </Link>
          <div className="flex-1 flex items-stretch">{der.map((i) => <Tab key={i.to} item={i} on={activo(marcada, i.to)} actual={ariaActual(activo(marcada, i.to), pathname, i.to)} />)}</div>
        </div>
      </nav>}
    </div>
  )
}

function Tab({ item, on, actual }: { item: Item; on: boolean; actual: 'page' | true | undefined }) {
  return (
    <Link to={item.to} aria-current={actual}
      className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-0.5 min-h-[58px] text-[11px] ${on ? 'text-brand font-semibold' : 'text-muted font-medium'}`}>
      <Icon name={item.icon} className="w-[21px] h-[21px]" stroke={on ? 2.1 : 1.8} />
      <span>{item.label}</span>
    </Link>
  )
}
