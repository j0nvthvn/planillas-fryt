import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import Icon from './Icon'

const PAGE_TITLES = {
  '/turno':          'Turno',
  '/resumen':        'Resumen del día',
  '/dashboard':      'Dashboard',
  '/historial':      'Historial',
  '/proveedores':    'Proveedores',
  '/usuarios':       'Usuarios',
  '/turno/editar':   'Editar turno',
  '/configuracion':  'Configuración',
}

const navTrabajador = [
  { to: '/turno',   label: 'Turno',   icon: 'note' },
  { to: '/resumen', label: 'Resumen', icon: 'summary' },
]

const navDueno = [
  { to: '/turno',      label: 'Turno',      icon: 'note' },
  { to: '/resumen',    label: 'Resumen',     icon: 'summary' },
  { to: '/dashboard',  label: 'Dashboard',   icon: 'chart' },
  { to: '/historial',  label: 'Historial',   icon: 'history' },
]

const masItems = [
  { to: '/proveedores',   label: 'Proveedores',   icon: 'suppliers' },
  { to: '/usuarios',      label: 'Usuarios',       icon: 'users' },
  { to: '/configuracion', label: 'Configuración',  icon: 'settings' },
]

function NavLink({ to, icon, label, onClick }) {
  const location = useLocation()
  const activo = location.pathname.startsWith(to)
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        activo ? 'bg-brand-tint text-brand' : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100'
      }`}
    >
      <Icon name={icon} className="w-5 h-5 shrink-0" stroke={activo ? 2.2 : 1.8} />
      {label}
    </Link>
  )
}

function TabItem({ to, icon, label }) {
  const location = useLocation()
  const activo = location.pathname.startsWith(to)
  return (
    <Link
      to={to}
      aria-current={activo ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 min-h-[56px] text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${
        activo ? 'text-brand' : 'text-gray-400 dark:text-zinc-500'
      }`}
    >
      <span className={`flex items-center justify-center w-10 h-6 rounded-full transition-colors ${activo ? 'bg-brand-tint' : ''}`}>
        <Icon name={icon} className="w-5 h-5" stroke={activo ? 2.2 : 1.8} />
      </span>
      <span>{label}</span>
    </Link>
  )
}

const fechaHoy = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long', day: 'numeric', month: 'long',
}).format(new Date())

export default function Layout({ children }) {
  const { usuario, esDueno, signOut } = useAuth()
  const { config } = useConfig()
  const location = useLocation()
  const navigate = useNavigate()

  const [popoverAbierto, setPopoverAbierto] = useState(false)
  const [masMontado, setMasMontado] = useState(false)
  const [masVisible, setMasVisible] = useState(false)
  const [sheetListo, setSheetListo] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const tabs = esDueno ? navDueno : navTrabajador
  const sidebarItems = esDueno ? [...navDueno, ...masItems] : navTrabajador

  const titulo =
    PAGE_TITLES[location.pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => location.pathname.startsWith(k))?.[1] ??
    'Fryt'

  const masActivo = masItems.some((r) => location.pathname.startsWith(r.to))

  function abrirMas() {
    setMasMontado(true)
    setSheetListo(false)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setMasVisible(true)
      setTimeout(() => setSheetListo(true), 320)
    }))
  }

  function cerrarMas() {
    setMasVisible(false)
    setSheetListo(false)
    setTimeout(() => setMasMontado(false), 220)
  }

  useEffect(() => {
    if (!masMontado) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) { if (e.key === 'Escape') cerrarMas() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [masMontado])

  useEffect(() => {
    if (!masMontado) return
    window.history.pushState({ mas: true }, '')
    function onPop() { cerrarMas() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [masMontado])

  function pedirConfirmacionLogout() {
    setPopoverAbierto(false)
    cerrarMas()
    setConfirmLogout(true)
  }

  async function handleSignOut() {
    setConfirmLogout(false)
    await signOut()
    navigate('/login')
  }

  const inicial = usuario?.nombre?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="app-shell flex flex-col bg-[#FBF6EC] dark:bg-zinc-950">

      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="relative bg-white dark:bg-zinc-900 border-b border-brand-tint dark:border-zinc-800 sticky top-0 z-20"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg grid place-items-center bg-brand-tint text-brand shrink-0" aria-hidden="true">
              <Icon name="store" className="w-4 h-4" stroke={2} />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-brand dark:text-brand-tint leading-tight truncate">{config.nombreLocal}</span>
              <span className="block font-semibold text-[15px] text-gray-900 dark:text-zinc-100 truncate leading-tight">{titulo}</span>
            </div>
          </div>

          {/* Avatar */}
          <button
            type="button"
            onClick={() => setPopoverAbierto((v) => !v)}
            aria-label={`Cuenta de ${usuario?.nombre ?? 'usuario'}`}
            aria-expanded={popoverAbierto}
            className="w-8 h-8 rounded-full bg-brand text-white text-[13px] font-bold grid place-items-center shrink-0 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            {inicial}
          </button>

          {/* Popover logout */}
          {popoverAbierto && (
            <>
              <button type="button" className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setPopoverAbierto(false)} />
              <div role="menu" className="absolute right-4 top-[calc(100%+4px)] z-40 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-800 py-1 min-w-[160px]">
                <p className="px-3 py-2 text-xs text-gray-500 dark:text-zinc-400 font-medium border-b border-gray-100 dark:border-zinc-800 truncate">
                  {usuario?.nombre ?? 'Usuario'}
                </p>
                <button
                  role="menuitem"
                  type="button"
                  onClick={pedirConfirmacionLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-b-xl"
                >
                  <Icon name="logout" className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Cuerpo: sidebar + contenido ────────────────── */}
      <div className="flex flex-1 min-h-0 max-w-6xl mx-auto w-full overflow-hidden md:overflow-visible">

        {/* Sidebar desktop (md+) */}
        <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-brand-tint dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-[calc(env(safe-area-inset-top)+44px)] h-[calc(100vh-44px)] overflow-y-auto">
          <nav className="flex-1 space-y-0.5 px-2 py-4" aria-label="Navegación principal">
            {sidebarItems.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </nav>
          <div className="border-t border-gray-100 dark:border-zinc-800 p-2">
            <button
              type="button"
              onClick={pedirConfirmacionLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 dark:hover:text-red-400 transition-colors"
            >
              <Icon name="logout" className="w-5 h-5 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 min-h-0 min-w-0 px-4 md:px-8 pt-5 pb-nav md:pb-8 overflow-y-auto overflow-x-hidden md:overflow-visible">
          {children}
        </main>
      </div>

      {/* ── Bottom nav (solo mobile) ────────────────────── */}
      <nav
        aria-label="Navegación principal"
        className="md:hidden shrink-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 z-20"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch">
          {tabs.map((tab) => (
            <TabItem key={tab.to} {...tab} />
          ))}
          {esDueno && (
            <button
              type="button"
              onClick={abrirMas}
              aria-expanded={masMontado}
              aria-label="Más opciones"
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 min-h-[56px] text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${
                masActivo ? 'text-brand' : 'text-gray-400 dark:text-zinc-500'
              }`}
            >
              <span className={`flex items-center justify-center w-10 h-6 rounded-full transition-colors ${masActivo ? 'bg-brand-tint' : ''}`}>
                <Icon name="menu" className="w-5 h-5" stroke={masActivo ? 2.2 : 1.8} />
              </span>
              <span>Más</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Sheet "Más" (solo mobile) ───────────────────── */}
      {masMontado && (
        <>
          <button
            type="button"
            aria-label="Cerrar más opciones"
            onClick={cerrarMas}
            className="fixed inset-0 z-40 bg-black/35 transition-opacity duration-200 md:hidden"
            style={{ opacity: masVisible ? 1 : 0 }}
          />
          <div
            role="dialog"
            aria-label="Más opciones"
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl transition-transform duration-[220ms] ease-out md:hidden"
            style={{ transform: masVisible ? 'translateY(0)' : 'translateY(100%)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
            </div>
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Más opciones</p>
            <nav className={`px-3 space-y-0.5 transition-none ${sheetListo ? '' : 'pointer-events-none'}`}
              aria-label="Secciones adicionales"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
              {masItems.map((item) => (
                <NavLink key={item.to} {...item} onClick={cerrarMas} />
              ))}
            </nav>
          </div>
        </>
      )}

      {/* ── Modal confirmar cierre de sesión ────────────── */}
      {confirmLogout && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setConfirmLogout(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">¿Cerrar sesión?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Tendrás que volver a ingresar tus credenciales.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmLogout(false)}
                  className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button onClick={handleSignOut}
                  className="flex-1 btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
