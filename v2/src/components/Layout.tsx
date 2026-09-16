import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Icon, { type IconName } from './Icon'
import { useOnline } from '@/hooks/useOnline'
import { useUsuario } from '@/hooks/useUsuario'
import { AvatarMenu } from './AvatarMenu'

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

function activo(pathname: string, to: string) {
  return to === '/hoy' ? pathname === '/hoy' || pathname === '/' : pathname === to || pathname.startsWith(to + '/')
}

function ActualizacionBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="shrink-0 z-30 flex items-center justify-between gap-3 bg-info text-on-solid text-sm font-semibold px-4 py-2">
      <span>Hay una versión nueva de FrytControl.</span>
      <button onClick={() => void updateServiceWorker(true)} className="rounded-lg bg-on-solid/20 px-3 py-1 font-bold">Actualizar</button>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { esDueno } = useUsuario()
  const online = useOnline()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const items = ITEMS.filter((i) => !i.dueno || esDueno)
  const tabsMovil = items.filter((i) => (esDueno ? TABS_MOVIL_DUENO : TABS_MOVIL_LOCAL).includes(i.to))
  const mitad = Math.ceil(tabsMovil.length / 2)
  const izq = tabsMovil.slice(0, mitad)
  const der = tabsMovil.slice(mitad)
  const fab = items.find((i) => i.to === '/turno')!

  return (
    <div className="app-shell flex flex-col bg-canvas">
      <ActualizacionBanner />
      {!online && (
        <div role="status" className="shrink-0 z-30 flex items-center justify-center gap-2 bg-warn text-on-solid text-xs font-semibold px-3 py-2 text-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
          Sin conexión: se guarda en este dispositivo y se reintenta al volver
        </div>
      )}

      <div className="flex flex-1 min-h-0 max-w-screen-2xl mx-auto w-full overflow-hidden md:overflow-visible">
        <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-hairline bg-card sticky top-0 h-screen overflow-y-auto">
          <div className="px-5 pt-6 pb-4">
            <p className="eyebrow text-brand">FrytControl</p>
            <p className="text-xs text-muted2 mt-0.5">Minimarket Fryt</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-2 pb-4" aria-label="Navegación principal">
            {items.map((i) => {
              const on = activo(pathname, i.to)
              return (
                <Link key={i.to} to={i.to} aria-current={on ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${on ? 'bg-brand-tint text-brand' : 'text-ink2 hover:bg-canvas hover:text-ink'}`}>
                  <Icon name={i.icon} className="w-5 h-5 shrink-0" stroke={on ? 2.2 : 1.8} />{i.label}
                </Link>
              )
            })}
          </nav>
          <div className="px-2 pb-4 border-t border-hairline pt-2">
            <AvatarMenu variante="bloque" />
          </div>
        </aside>

        <main className="flex-1 min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-5 pb-nav md:pb-8 overflow-y-auto overflow-x-hidden md:overflow-visible">
          {children}
        </main>
      </div>

      <nav aria-label="Navegación principal" className="md:hidden shrink-0 relative bg-card border-t border-hairline"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-stretch">
          <div className="flex-1 flex items-stretch">{izq.map((i) => <Tab key={i.to} item={i} on={activo(pathname, i.to)} />)}</div>
          <div className="w-16 shrink-0" aria-hidden="true" />
          <div className="flex-1 flex items-stretch">{der.map((i) => <Tab key={i.to} item={i} on={activo(pathname, i.to)} />)}</div>
        </div>
        {/* En Cerrar turno el botón competía con "Cerrar el día" y tapaba su barra. */}
        {!activo(pathname, fab.to) && <Link to={fab.to}
          className="absolute left-1/2 -translate-x-1/2 bottom-[max(8px,env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-1 text-xs font-semibold text-brand">
          <span className="flex items-center justify-center w-14 h-14 -mt-7 rounded-full shadow-hero text-on-solid bg-brand">
            <Icon name="plus" className="w-6 h-6" stroke={2.2} />
          </span>
          <span>Cerrar caja</span>
        </Link>}
      </nav>
    </div>
  )
}

function Tab({ item, on }: { item: Item; on: boolean }) {
  return (
    <Link to={item.to} aria-current={on ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 min-h-[60px] text-xs font-medium ${on ? 'text-brand' : 'text-muted'}`}>
      <span className={`flex items-center justify-center w-12 h-7 rounded-full ${on ? 'bg-brand-tint' : ''}`}>
        <Icon name={item.icon} className="w-5 h-5" stroke={on ? 2.2 : 1.8} />
      </span>
      <span className={on ? 'font-bold' : ''}>{item.label}</span>
    </Link>
  )
}
