import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import Icon from './Icon'

const navTrabajador = [
  { to: '/hoy',    label: 'Hoy',      icon: 'home' },
  { to: '/turno',  label: 'Ingresar', icon: 'plus' },
]

const navDueno = [
  { to: '/hoy',       label: 'Hoy',      icon: 'home' },
  { to: '/turno',     label: 'Ingresar', icon: 'plus' },
  { to: '/analisis',  label: 'Análisis', icon: 'chart' },
  { to: '/historial', label: 'Historial', icon: 'history' },
]

// En la barra móvil, Historial se saca de los tabs: con Ingresar como botón
// flotante centrado, dejar 3 tabs (1 a la izquierda, 2 a la derecha) se ve
// desbalanceado. Historial ahora se accede desde un ícono en el header de
// Hoy — sigue disponible completo en el sidebar de escritorio, donde no hay
// esa restricción de simetría.
const OCULTOS_TAB_MOVIL = ['/historial']

function isActive(location, to) {
  if (location.pathname === to) return true
  if (to === '/hoy' && (location.pathname === '/resumen' || location.pathname === '/hoy')) return true
  if (to === '/analisis' && (location.pathname === '/dashboard' || location.pathname === '/analisis')) return true
  return false
}

function NavLink({ to, icon, label, onClick }) {
  const location = useLocation()
  const activo = isActive(location, to)
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        activo ? 'bg-brand-tint text-brand' : 'text-ink2 hover:bg-canvas hover:text-ink'
      }`}
    >
      <Icon name={icon} className="w-5 h-5 shrink-0" stroke={activo ? 2.2 : 1.8} />
      {label}
    </Link>
  )
}

function TabItem({ to, icon, label }) {
  const location = useLocation()
  const activo = isActive(location, to)
  return (
    <Link
      to={to}
      aria-current={activo ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 min-h-[56px] text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${
        activo ? 'text-brand' : 'text-muted2'
      }`}
    >
      <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${activo ? 'bg-brand-tint' : ''}`}>
        <Icon name={icon} className="w-5 h-5" stroke={activo ? 2.2 : 1.8} />
      </span>
      <span className={activo ? 'font-bold' : ''}>{label}</span>
    </Link>
  )
}

// Acción principal (Ingresar turno): se eleva como botón flotante centrado
// sobre la barra, en vez de competir en igualdad de tamaño con el resto de
// tabs — es la pantalla que más se usa durante el turno, y así queda
// destacada. Se posiciona absoluto (no como un ítem más del flex) para que
// quede centrado sin importar cuántos tabs haya a cada lado, y con z-index
// por encima de la barra fija "Guardar turno" (above-nav, z-30) para que
// esta no la tape al sobresalir.
function TabFab({ to, icon, label }) {
  const location = useLocation()
  const activo = isActive(location, to)
  return (
    <Link
      to={to}
      aria-current={activo ? 'page' : undefined}
      className="absolute left-1/2 -translate-x-1/2 bottom-0 z-40 flex flex-col items-center gap-1 pb-1 min-h-[56px] text-[10px] font-medium text-brand focus:outline-none"
    >
      <span
        className={`flex items-center justify-center w-14 h-14 -mt-7 rounded-full shadow-hero text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
          activo ? 'bg-brand-hover' : 'bg-brand'
        }`}
      >
        <Icon name={icon} className="w-6 h-6" stroke={2.2} />
      </span>
      <span className={activo ? 'font-bold' : ''}>{label}</span>
    </Link>
  )
}

export default function Layout({ children }) {
  const { esDueno } = useAuth()
  const online = useOnlineStatus()
  const tabs = esDueno ? navDueno : navTrabajador
  const tabsMovil = tabs.filter((t) => !OCULTOS_TAB_MOVIL.includes(t.to))
  const fabIndex = tabsMovil.findIndex((t) => t.to === '/turno')
  const fabTab = fabIndex >= 0 ? tabsMovil[fabIndex] : null
  const tabsIzq = fabIndex >= 0 ? tabsMovil.slice(0, fabIndex) : tabsMovil
  const tabsDer = fabIndex >= 0 ? tabsMovil.slice(fabIndex + 1) : []

  return (
    <div className="app-shell flex flex-col bg-canvas">

      {!online && (
        <div className="shrink-0 z-30 flex items-center justify-center gap-2 bg-warn text-white text-[12.5px] font-semibold px-3 py-2 text-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
          Sin conexión — los cambios no se están guardando
        </div>
      )}

      <div className="flex flex-1 min-h-0 max-w-screen-2xl mx-auto w-full overflow-hidden md:overflow-visible">

        <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-hairline bg-card sticky top-0 h-screen overflow-y-auto">
          <div className="px-5 pt-6 pb-4">
            <p className="eyebrow text-brand">FrytControl</p>
            <p className="text-[11px] text-muted2 mt-0.5">Minimarket Fryt</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-2 pb-4" aria-label="Navegación principal">
            {tabs.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-h-0 min-w-0 px-[22px] md:px-8 pt-5 pb-nav md:pb-8 overflow-y-auto overflow-x-hidden md:overflow-visible">
          {children}
        </main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="md:hidden shrink-0 relative bg-card border-t border-hairline overflow-visible"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch overflow-visible">
          <div className="flex-1 flex items-stretch">
            {tabsIzq.map((tab) => <TabItem key={tab.to} {...tab} />)}
          </div>
          {fabTab && <div className="w-14 shrink-0" aria-hidden="true" />}
          <div className="flex-1 flex items-stretch">
            {tabsDer.map((tab) => <TabItem key={tab.to} {...tab} />)}
          </div>
        </div>
        {fabTab && <TabFab {...fabTab} />}
      </nav>
    </div>
  )
}
