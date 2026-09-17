import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BottomSheet } from './BottomSheet'
import Icon from './Icon'
import { useUsuario } from '@/hooks/useUsuario'
import { cerrarSesion } from '@/lib/auth'

/**
 * Abre el menú de cuenta (cerrar sesión pide confirmación). `avatar` es el
 * cuadrado con las iniciales que va en Hoy; `bloque` es la fila con nombre y rol
 * del pie de la barra lateral, para no depender de una pantalla concreta
 * para cerrar sesión en escritorio.
 */
export function AvatarMenu({ variante = 'avatar' }: { variante?: 'avatar' | 'bloque' }) {
  const { usuario, esDueno } = useUsuario()
  const [abierto, setAbierto] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const inicial = iniciales(usuario?.nombre)
  const rol = usuario?.rol === 'dueño' ? 'dueña' : 'cuenta del local'
  return (
    <>
      {variante === 'avatar' ? (
        <button type="button" onClick={() => setAbierto(true)} aria-haspopup="dialog" aria-label={`Cuenta de ${usuario?.nombre ?? 'usuario'}`}
          className="w-10 h-10 rounded-[12px] bg-soft border border-hairline text-ink2 text-sm font-semibold grid place-items-center shrink-0">
          {inicial}
        </button>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} aria-haspopup="dialog"
          className="w-full flex items-center gap-3 rounded-[10px] px-[11px] py-2.5 text-left hover:bg-soft">
          <span className="w-[34px] h-[34px] rounded-[10px] bg-soft border border-hairline text-ink2 text-sm font-semibold grid place-items-center shrink-0" aria-hidden="true">{inicial}</span>
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
            <div className="rounded-[12px] border border-hairline bg-neg-tint px-4 py-3">
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

/** "Jonathan Flores" → "JF"; un solo nombre → su inicial. */
function iniciales(nombre: string | null | undefined) {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  return partes.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}
