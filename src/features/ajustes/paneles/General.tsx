import { useId, useState } from 'react'
import Spinner from '@/components/Spinner'
import { MontoInput, HoraInput } from '@/components/MontoInput'
import { useToast } from '@/components/Toast'
import { mensajeDeError } from '@/lib/errorLog'
import { useConfig, useGuardarConfig, type Config } from '@/features/catalogo/api'
import { CAMPO, Fila } from '../Fila'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function General() {
  const { config, cargando } = useConfig()
  const guardar = useGuardarConfig()
  const toast = useToast()
  const [form, setForm] = useState<Config | null>(null)
  const diasId = useId()
  const f = form ?? config
  if (cargando) return <Spinner />
  const set = (c: Partial<Config>) => setForm({ ...f, ...c })
  return (
    <div>
      <h2 className="eyebrow mb-[9px]">Operación</h2>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        <Fila apilar label="Nombre del local"><input className={`input ${CAMPO} w-full sm:w-40 sm:text-right`} value={f.nombreLocal} onChange={(e) => set({ nombreLocal: e.target.value })} aria-label="Nombre del local" /></Fila>
        <Fila apilar label="Fondo de caja por defecto" hint="Con lo que parte cada turno"><MontoInput className={`${CAMPO} font-display font-semibold w-full sm:w-40 sm:text-right`} value={f.fondoCajaInicial} onChange={(n) => set({ fondoCajaInicial: n })} ariaLabel="Fondo de caja por defecto" /></Fila>
        <Fila apilar label="Corte de la mañana" hint="Hora en que termina el turno mañana"><HoraInput className={`${CAMPO} font-display font-semibold w-full sm:w-32 sm:text-right`} value={f.horaCorteManana} onChange={(h) => set({ horaCorteManana: h })} ariaLabel="Corte de la mañana" /></Fila>
        <div className="px-4 py-3.5">
          <p id={diasId} className="text-base font-medium text-ink">Días de un solo turno</p>
          <p id={`${diasId}-ayuda`} className="text-xs text-muted mt-0.5 mb-2.5">Esos días se registran siempre como día completo</p>
          <div className="grid grid-cols-7 gap-1" role="group" aria-labelledby={diasId} aria-describedby={`${diasId}-ayuda`}>
            {DIAS.map((d, i) => {
              const on = f.diasTurnoUnico.includes(i)
              return <button key={d} type="button" aria-pressed={on} aria-label={DIAS_LARGOS[i]} onClick={() => set({ diasTurnoUnico: on ? f.diasTurnoUnico.filter((x) => x !== i) : [...f.diasTurnoUnico, i].sort() })}
                className={`hit min-h-[38px] px-0 rounded-[9px] text-sm border transition-colors ${on ? 'bg-ink text-card border-ink font-semibold' : 'bg-card text-ink2 border-hairline-strong font-medium hover:bg-soft'}`}>{d}</button>
            })}
          </div>
        </div>
      </div>
      {form && <button type="button" className="btn-primary btn-lg w-full mt-3" disabled={guardar.isPending} onClick={() => guardar.mutate(form, { onSuccess: () => { setForm(null); toast.ok('Ajustes guardados') }, onError: (e) => toast.error(mensajeDeError(e)) })}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</button>}
    </div>
  )
}
