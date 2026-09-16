import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BottomSheet } from './BottomSheet'
import Icon from './Icon'
import { useUsuario } from '@/hooks/useUsuario'
import { cerrarSesion } from '@/lib/auth'

/**
 * Abre el menú de cuenta (cerrar sesión pide confirmación). `avatar` es el
 * círculo con la inicial que va en Hoy; `bloque` es la fila con nombre y rol
 * del pie de la barra lateral, para no depender de una pantalla concreta
 * para cerrar sesión en escritorio.
 */
export function AvatarMenu({ variante = 'avatar' }: { variante?: 'avatar' | 'bloque' }) {
  const { usuario, esDueno } = useUsuario()
  const [abierto, setAbierto] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const inicial = (usuario?.nombre?.[0] ?? '?').toUpperCase()
  const rol = usuario?.rol === 'dueño' ? 'dueña' : 'cuenta del local'
  return (
    <>
      {variante === 'avatar' ? (
        <button type="button" onClick={() => setAbierto(true)} aria-haspopup="dialog" aria-label={`Cuenta de ${usuario?.nombre ?? 'usuario'}`}
          className="w-[42px] h-[42px] rounded-full bg-brand text-on-solid font-bold grid place-items-center shrink-0">
          {inicial}
        </button>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} aria-haspopup="dialog"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-canvas">
          <span className="w-9 h-9 rounded-full bg-brand text-on-solid font-bold grid place-items-center shrink-0" aria-hidden="true">{inicial}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink truncate">{usuario?.nombre ?? 'Cuenta'}</span>
            <span className="block text-xs text-muted truncate">{rol}</span>
          </span>
          <Icon name="chevR" className="w-4 h-4 text-muted2 shrink-0" />
        </button>
      )}
      {abierto && (
        <BottomSheet title={usuario?.nombre ?? 'Cuenta'} onClose={() => { setAbierto(false); setConfirmar(false) }}>
          <p className="text-sm text-muted -mt-1">{usuario?.email} · {rol}</p>
          {esDueno && (
            <Link to="/ajustes" onClick={() => setAbierto(false)} className="btn-secondary w-full justify-start"><Icon name="settings" className="w-5 h-5" />Ajustes</Link>
          )}
          {esDueno && (
            <Link to="/proveedores" onClick={() => setAbierto(false)} className="btn-secondary w-full justify-start"><Icon name="suppliers" className="w-5 h-5" />Proveedores</Link>
          )}
          {!confirmar ? (
            <button type="button" className="btn-ghost w-full justify-start text-neg" onClick={() => setConfirmar(true)}><Icon name="logout" className="w-5 h-5" />Cerrar sesión…</button>
          ) : (
            <div className="rounded-2xl bg-neg-tint px-4 py-3">
              <p className="text-sm text-neg font-semibold mb-2">¿Cerrar la sesión en este dispositivo?</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmar(false)}>No</button>
                <button type="button" className="btn-danger flex-1" onClick={() => void cerrarSesion()}>Sí, cerrar sesión</button>
              </div>
            </div>
          )}
        </BottomSheet>
      )}
    </>
  )
}
