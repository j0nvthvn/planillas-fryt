import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Icon from './Icon'
import ConfirmDialog from './ConfirmDialog'

const ITEMS = [
  { to: '/proveedores',   label: 'Proveedores',   icon: 'suppliers' },
  { to: '/usuarios',      label: 'Usuarios',       icon: 'users' },
  { to: '/configuracion', label: 'Configuración',  icon: 'settings' },
]

export default function AvatarMenu({ open, onClose, anchorRight = true }) {
  const navigate = useNavigate()
  const { usuario, esDueno, signOut } = useAuth()
  const items = esDueno ? ITEMS : []
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )
  const desktopRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted || !isDesktop) return
    function onClickOutside(e) {
      if (desktopRef.current && !desktopRef.current.contains(e.target)) {
        onCloseRef.current()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [mounted, isDesktop])

  function go(to) {
    onClose()
    navigate(to)
  }

  async function handleSignOut() {
    setConfirmLogout(false)
    onClose()
    await signOut()
    navigate('/login')
  }

  if (!mounted) return null

  return (
    <>
      {/* Overlay (móvil y desktop como capa de click-outside sutil) */}
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={onClose}
        className="fixed inset-0 z-40 md:hidden bg-black/40 dark:bg-black/70"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms' }}
      />

      {/* Popover (desktop) */}
      {isDesktop ? (
        <div
          ref={desktopRef}
          role="menu"
          className="absolute right-4 top-[calc(env(safe-area-inset-top)+56px)] z-50 min-w-[220px] bg-card rounded-2xl shadow-2xl border border-hairline py-2"
          style={{ animation: 'menuIn .18s ease-out' }}
        >
          <p className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted2">
            {usuario?.nombre ?? 'Usuario'}
          </p>
          <div className="h-px bg-hairline mx-2 mb-1" />
          {items.map((item) => (
            <button
              key={item.to}
              role="menuitem"
              type="button"
              onClick={() => go(item.to)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
            >
              <Icon name={item.icon} className="w-[18px] h-[18px] text-brand" />
              {item.label}
            </button>
          ))}
          <div className="h-px bg-hairline mx-2 my-1" />
          <button
            role="menuitem"
            type="button"
            onClick={() => { onClose(); setConfirmLogout(true) }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-neg"
          >
            <Icon name="logout" className="w-[18px] h-[18px]" />
            Cerrar sesión
          </button>
        </div>
      ) : (
        /* Bottom sheet (móvil) */
        <div
          role="dialog"
          aria-label="Más opciones"
          className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[28px] px-4 pt-3 pb-2"
          style={{
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 220ms cubic-bezier(.2,.8,.2,1)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            boxShadow: '0 -20px 50px -20px rgba(0,0,0,.4)',
          }}
        >
          <div className="flex justify-center pt-1 pb-3">
            <div className="w-10 h-1 rounded-full bg-hairline" />
          </div>
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-widest text-muted2">
            Más opciones
          </p>
          <nav className="space-y-0.5">
            {items.map((item) => (
              <button
                key={item.to}
                role="menuitem"
                type="button"
                onClick={() => go(item.to)}
                className="flex w-full items-center gap-3 px-2 py-3 rounded-2xl text-[15px] font-semibold text-ink hover:bg-canvas"
              >
                <Icon name={item.icon} className="w-5 h-5 text-brand" />
                {item.label}
              </button>
            ))}
            <div className="h-px bg-hairline mx-2 my-2" />
            <button
              role="menuitem"
              type="button"
              onClick={() => { onClose(); setConfirmLogout(true) }}
              className="flex w-full items-center gap-3 px-2 py-3 rounded-2xl text-[15px] font-semibold text-neg hover:bg-neg-tint"
            >
              <Icon name="logout" className="w-5 h-5" />
              Cerrar sesión
            </button>
          </nav>
        </div>
      )}

      {/* Modal confirmar cierre de sesión */}
      <ConfirmDialog
        open={confirmLogout}
        title="¿Cerrar sesión?"
        description="Tendrás que volver a ingresar tus credenciales."
        confirmLabel="Cerrar sesión"
        danger
        zIndex={60}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleSignOut}
      />

      <style>{`@keyframes menuIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </>
  )
}
