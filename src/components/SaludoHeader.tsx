import { useState } from 'react'
import Icon from './Icon'
import { ConfirmDialog } from './ConfirmDialog'
import { Banda } from './Banda'
import { useUsuario } from '@/hooks/useUsuario'
import { cerrarSesion } from '@/lib/auth'
import { fechaSinAnio, primerNombre } from '@/lib/format'

/**
 * Encabezado de Hoy: logo, saludo y fecha sobre la banda de color.
 * La cuenta del local no entra a Ajustes: cierra sesión desde aquí.
 */
export function SaludoHeader({ fecha }: { fecha: string }) {
  const { usuario, esDueno } = useUsuario()
  const [salir, setSalir] = useState(false)
  const nombre = primerNombre(usuario?.nombre)
  return (
    <>
      <Banda />
      <header className="flex items-center justify-between gap-3 pt-1 mb-6 md:px-7 md:pt-7 md:mb-9">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.jpg" alt="" width={44} height={44} className="w-11 h-11 rounded-full shrink-0 ring-2 ring-white/70" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/80 mb-[3px] truncate">{fechaSinAnio(fecha)}</p>
            <h1 className="font-display text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-white truncate">{nombre ? `Hola, ${nombre}` : 'Hola'}</h1>
          </div>
        </div>
        {usuario && !esDueno && (
          <button type="button" onClick={() => setSalir(true)} aria-label="Cerrar sesión"
            className="w-11 h-11 rounded-[14px] bg-white/15 text-white grid place-items-center shrink-0 hover:bg-white/25 transition-colors">
            <Icon name="logout" className="w-5 h-5" />
          </button>
        )}
      </header>
      {salir && (
        <ConfirmDialog title="¿Cerrar la sesión en este dispositivo?" confirmLabel="Sí, cerrar sesión" cancelLabel="No" danger
          onConfirm={() => void cerrarSesion()} onCancel={() => setSalir(false)} />
      )}
    </>
  )
}
