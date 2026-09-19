import { useState } from 'react'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAccion } from '@/hooks/useAccion'
import { useTrabajadores, crearTrabajador, actualizarTrabajador, eliminarTrabajador } from '@/features/catalogo/api'
import { ACCION, Fila } from '../Fila'

export function Trabajadores() {
  const lista = useTrabajadores(false)
  const run = useAccion()
  const [nuevo, setNuevo] = useState('')
  const [borrar, setBorrar] = useState<{ id: string; nombre: string } | null>(null)
  if (lista.isPending) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">Quiénes atienden el local. No son cuentas: se eligen al cerrar el turno.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nuevo.trim()) void run(() => crearTrabajador(nuevo).then(() => setNuevo('')), 'Agregado') }}>
        <input className="input flex-1" placeholder="Nombre" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="Nombre del trabajador" />
        <button type="submit" className="btn-primary px-4" disabled={!nuevo.trim()}>Agregar</button>
      </form>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((t) => (
          <Fila key={t.id} label={t.nombre} hint={t.activo ? undefined : 'Inactivo'}>
            <div className="flex items-center gap-1.5">
              <button type="button" className={`${ACCION} font-semibold border border-hairline-strong text-ink2 hover:bg-soft`} aria-label={`${t.activo ? 'Desactivar' : 'Activar'} a ${t.nombre}`} onClick={() => void run(() => actualizarTrabajador(t.id, { activo: !t.activo }), t.activo ? 'Desactivado' : 'Activado')}>{t.activo ? 'Desactivar' : 'Activar'}</button>
              <button type="button" className={`${ACCION} w-[34px] px-0 text-neg hover:bg-neg-tint`} onClick={() => setBorrar(t)} aria-label={`Eliminar ${t.nombre}`}><Icon name="trash" className="w-4 h-4" /></button>
            </div>
          </Fila>
        ))}
        {(lista.data ?? []).length === 0 && <p className="text-center text-muted py-6 text-sm">Aún no hay trabajadores.</p>}
      </div>
      {borrar && <ConfirmDialog title={`¿Eliminar a ${borrar.nombre}?`} message="Los turnos que atendió quedan sin nombre asociado. Si solo dejó de trabajar, mejor desactívalo." danger confirmLabel="Eliminar" onCancel={() => setBorrar(null)} onConfirm={() => { void run(() => eliminarTrabajador(borrar.id), 'Eliminado'); setBorrar(null) }} />}
    </div>
  )
}
