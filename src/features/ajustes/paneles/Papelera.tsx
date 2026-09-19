import { useState } from 'react'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAccion } from '@/hooks/useAccion'
import { clp, fechaHora, fechaDiaMes } from '@/lib/format'
import { totalVentas } from '@/lib/totales'
import { usePapelera, restaurarTurno, purgarTurno, etiquetaModo } from '@/features/turno/api'
import { ACCION, Fila } from '../Fila'

export function Papelera() {
  const lista = usePapelera()
  const run = useAccion()
  const [purgar, setPurgar] = useState<string | null>(null)
  if (lista.isPending) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">Turnos eliminados. Se pueden restaurar o borrar definitivamente.</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((t) => (
          <Fila key={t.id} alta label={`${fechaDiaMes(t.jornada?.fecha)} · ${etiquetaModo(t.jornada?.es_turno_unico && t.tipo === 'mañana' ? 'completo' : t.tipo)}`} hint={`ventas ${clp(totalVentas(t.ventas))} · eliminado ${fechaHora(t.deleted_at)}`}>
            <div className="flex items-center gap-1.5">
              <button type="button" className={`${ACCION} font-semibold border border-hairline-strong text-ink2 hover:bg-soft`} aria-label={`Restaurar ${fechaDiaMes(t.jornada?.fecha)}`} onClick={() => void run(() => restaurarTurno(t.id, t.jornada?.fecha ?? ''), 'Turno restaurado')}><Icon name="undo" className="w-3.5 h-3.5" />Restaurar</button>
              <button type="button" className={`${ACCION} w-[34px] px-0 text-neg hover:bg-neg-tint`} onClick={() => setPurgar(t.id)} aria-label={`Borrar definitivamente ${fechaDiaMes(t.jornada?.fecha)}`}><Icon name="trash" className="w-4 h-4" /></button>
            </div>
          </Fila>
        ))}
        {(lista.data ?? []).length === 0 && <p className="text-center text-muted py-6 text-sm">La papelera está vacía.</p>}
      </div>
      {purgar && <ConfirmDialog title="¿Borrar definitivamente?" message="No se puede deshacer." danger confirmLabel="Borrar" onCancel={() => setPurgar(null)} onConfirm={() => { void run(() => purgarTurno(purgar), 'Borrado'); setPurgar(null) }} />}
    </div>
  )
}
