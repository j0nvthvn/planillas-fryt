import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BottomSheet } from './BottomSheet'
import Icon from './Icon'
import { useUsuario } from '@/hooks/useUsuario'
import { cerrarSesion } from '@/lib/auth'

/** Círculo con la inicial: abre un menú; cerrar sesión pide confirmación. */
export function AvatarMenu() {
  const { usuario, esDueno } = useUsuario()
  const [abierto, setAbierto] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const inicial = (usuario?.nombre?.[0] ?? '?').toUpperCase()
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} aria-haspopup="dialog" aria-label={`Cuenta de ${usuario?.nombre ?? 'usuario'}`}
        className="w-[42px] h-[42px] rounded-full bg-brand text-white font-bold grid place-items-center shrink-0 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
        {inicial}
      </button>
      {abierto && (
        <BottomSheet title={usuario?.nombre ?? 'Cuenta'} onClose={() => { setAbierto(false); setConfirmar(false) }}>
          <p className="text-[13px] text-muted -mt-1">{usuario?.email} · {usuario?.rol === 'dueño' ? 'dueña' : 'cuenta del local'}</p>
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
              <p className="text-[13.5px] text-neg font-semibold mb-2">¿Cerrar la sesión en este dispositivo?</p>
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
