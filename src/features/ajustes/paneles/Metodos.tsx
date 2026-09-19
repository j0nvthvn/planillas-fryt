import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { MetodoLogo } from '@/components/MetodoLogo'
import { useAccion } from '@/hooks/useAccion'
import { useMetodos, actualizarMetodo } from '@/features/catalogo/api'
import { ACCION } from '../Fila'

export function Metodos() {
  const lista = useMetodos(false)
  const run = useAccion()
  if (lista.isPending) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">Los métodos inactivos no aparecen al cerrar el turno. "Total del día" es para máquinas que no cierran por turno: al cerrar la tarde se escribe el total y la app resta la mañana.</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((m, i, arr) => (
          <div key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 min-h-[68px]">
            <span className={m.activo ? '' : 'opacity-50'}><MetodoLogo metodo={m} /></span>
            <div className="flex-1 min-w-0">
              <p className={`text-base font-medium truncate ${m.activo ? 'text-ink' : 'text-muted'}`}>{m.label}</p>
              {(m.sub || m.acumulado_diario) && <p className="text-xs text-muted mt-0.5">{[m.sub, m.acumulado_diario ? 'la máquina muestra el total del día' : null].filter(Boolean).join(' · ')}</p>}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button type="button" className={`${ACCION} w-[38px] min-h-[38px] px-0 text-ink2 hover:bg-soft`} disabled={i === 0} aria-label={`Subir ${m.label}`} onClick={() => { const prev = arr[i - 1]; if (prev) void run(async () => { await actualizarMetodo(m.key, { orden: prev.orden }); await actualizarMetodo(prev.key, { orden: m.orden }) }) }}><Icon name="caretUp" className="w-4 h-4" /></button>
              <button type="button" className={`${ACCION} w-[38px] min-h-[38px] px-0 text-ink2 hover:bg-soft`} disabled={i === arr.length - 1} aria-label={`Bajar ${m.label}`} onClick={() => { const next = arr[i + 1]; if (next) void run(async () => { await actualizarMetodo(m.key, { orden: next.orden }); await actualizarMetodo(next.key, { orden: m.orden }) }) }}><Icon name="caretDown" className="w-4 h-4" /></button>
            </div>
            {/* En el celular las acciones van en una segunda línea: al lado del nombre lo cortaban. */}
            <div className="flex items-center gap-1.5 basis-full pl-[52px] sm:basis-auto sm:pl-0">
              <button type="button" className={`${ACCION} ${m.acumulado_diario ? 'bg-brand-tint text-brand font-semibold' : 'border border-hairline-strong text-muted font-medium hover:bg-soft'}`} aria-pressed={m.acumulado_diario} aria-label={`Total del día en ${m.label}`} title="La máquina muestra el total del día" onClick={() => void run(() => actualizarMetodo(m.key, { acumulado_diario: !m.acumulado_diario }))}>Total del día</button>
              <button type="button" className={`${ACCION} font-semibold ${m.activo ? 'bg-pos-tint text-pos' : 'bg-neg-tint text-neg'}`} aria-pressed={m.activo} aria-label={`${m.label} activo`} onClick={() => void run(() => actualizarMetodo(m.key, { activo: !m.activo }))}>{m.activo ? 'Activo' : 'Inactivo'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
