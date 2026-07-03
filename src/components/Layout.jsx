import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
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

export default function Layout({ children }) {
  const { esDueno } = useAuth()
  const tabs = esDueno ? navDueno : navTrabajador

  return (
    <div className="app-shell flex flex-col bg-canvas">

      <div className="flex flex-1 min-h-0 max-w-screen-2xl mx-auto w-full overflow-hidden md:overflow-visible">

        <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-hairline bg-card sticky top-0 h-screen overflow-y-auto">
          <div className="px-5 pt-6 pb-4">
            <p className="eyebrow text-brand">Minimarket Fryt</p>
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
        className="md:hidden shrink-0 bg-card border-t border-hairline"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch">
          {tabs.map((tab) => (
            <TabItem key={tab.to} {...tab} />
          ))}
        </div>
      </nav>
    </div>
  )
}
