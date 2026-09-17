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
        <aside className="hidden md:flex flex-col w-[236px] shrink-0 border-r border-hairline bg-card sticky top-0 h-screen overflow-y-auto">
          <div className="px-5 pt-6 pb-4 mb-2 border-b border-hairline">
            <p className="font-display text-sm font-semibold tracking-[-0.01em] text-ink">FrytControl</p>
            <p className="text-xs text-muted mt-0.5">Minimarket Fryt</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-3 pb-4" aria-label="Navegación principal">
            {items.map((i) => {
              const on = activo(pathname, i.to)
              return (
                <Link key={i.to} to={i.to} aria-current={on ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-[11px] py-[9px] text-[14px] transition-colors ${on ? 'bg-brand-tint text-brand font-semibold' : 'text-ink2 font-medium hover:bg-soft hover:text-ink'}`}>
                  <Icon name={i.icon} className="w-5 h-5 shrink-0" stroke={on ? 2.1 : 1.8} />{i.label}
                </Link>
              )
            })}
          </nav>
          <div className="px-3 pb-4 border-t border-hairline pt-2">
            <AvatarMenu variante="bloque" />
          </div>
        </aside>

        <main className="flex-1 min-h-0 min-w-0 px-4 sm:px-6 md:px-8 pt-5 pb-nav md:pb-8 overflow-y-auto overflow-x-hidden md:overflow-visible">
          {children}
        </main>
      </div>

      <nav aria-label="Navegación principal" className="md:hidden shrink-0 relative bg-card border-t border-hairline"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-stretch">
          <div className="flex-1 flex items-stretch">{izq.map((i) => <Tab key={i.to} item={i} on={activo(pathname, i.to)} />)}</div>
          <div className="w-[76px] shrink-0" aria-hidden="true" />
          <div className="flex-1 flex items-stretch">{der.map((i) => <Tab key={i.to} item={i} on={activo(pathname, i.to)} />)}</div>
        </div>
        {/* En Cerrar turno el botón competía con "Cerrar el día" y tapaba su barra. */}
        {!activo(pathname, fab.to) && <Link to={fab.to} aria-label="Cerrar caja"
          className="absolute left-1/2 -translate-x-1/2 -top-[22px] z-40 grid place-items-center w-[58px] h-[58px] rounded-[19px] border-[3px] border-card bg-brand text-on-solid shadow-[0_8px_20px_-6px_rgba(79,70,229,.5)] hover:bg-brand-hover transition-colors">
          <Icon name="cash" className="w-6 h-6" stroke={2.3} />
        </Link>}
      </nav>
    </div>
  )
}

function Tab({ item, on }: { item: Item; on: boolean }) {
  return (
    <Link to={item.to} aria-current={on ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-0.5 min-h-[58px] text-[11px] ${on ? 'text-brand font-semibold' : 'text-muted font-medium'}`}>
      <Icon name={item.icon} className="w-[21px] h-[21px]" stroke={on ? 2.1 : 1.8} />
      <span>{item.label}</span>
    </Link>
  )
}
