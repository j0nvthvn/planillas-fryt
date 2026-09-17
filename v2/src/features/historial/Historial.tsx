import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { EstadoChip } from '@/features/hoy/Hoy'
import { PILDORA, PILDORA_ON, PILDORA_OFF } from '@/components/pildora'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import type { VResumenDia } from '@/features/turno/api'
import { clp, fechaDiaMes, mesAnio } from '@/lib/format'

const PAGINA = 30
type Filtro = 'todos' | 'borradores' | 'corregidos' | 'descuadres' | 'parciales'
const FILTROS: { v: Filtro; label: string }[] = [
  { v: 'todos', label: 'Todos' }, { v: 'borradores', label: 'Borradores' }, { v: 'parciales', label: 'Falta tarde' },
  { v: 'corregidos', label: 'Corregidos' }, { v: 'descuadres', label: 'Descuadres' },
]

export default function Historial() {
  const { filtro = 'todos' } = useSearch({ from: '/app/historial' })
  const navigate = useNavigate()
  const q = useInfiniteQuery({
    queryKey: qk.historial(filtro),
    initialPageParam: 0,
    getNextPageParam: (last: VResumenDia[], all) => (last.length < PAGINA ? undefined : all.length * PAGINA),
    queryFn: async ({ pageParam }): Promise<VResumenDia[]> => {
      let s = supabase.from('v_resumen_dia').select('*').order('fecha', { ascending: false }).range(pageParam, pageParam + PAGINA - 1)
      if (filtro === 'borradores') s = s.eq('tiene_borrador', true)
      if (filtro === 'corregidos') s = s.eq('corregido', true)
      if (filtro === 'descuadres') s = s.eq('con_descuadre', true)
      if (filtro === 'parciales') s = s.eq('estado', 'parcial')
      const { data, error } = await s
      if (error) throw error
      return data as VResumenDia[]
    },
  })
  const filas = q.data?.pages.flat() ?? []
  // Agrupadas por mes, en el orden en que llegan (de la más nueva a la más antigua).
  const meses: { mes: string; dias: VResumenDia[] }[] = []
  for (const d of filas) {
    const mes = d.fecha.slice(0, 7)
    const ultimo = meses.at(-1)
    if (ultimo?.mes === mes) ultimo.dias.push(d)
    else meses.push({ mes, dias: [d] })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Historial" />
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-3 md:flex-wrap md:mx-0 md:px-0" role="group" aria-label="Filtro">
        {FILTROS.map((f) => (
          <button key={f.v} type="button" aria-pressed={filtro === f.v}
            onClick={() => void navigate({ to: '/historial', search: { filtro: f.v } })}
            className={`${PILDORA} ${filtro === f.v ? PILDORA_ON : PILDORA_OFF}`}>
            {f.label}
          </button>
        ))}
      </div>

      {q.isPending ? <Spinner /> : filas.length === 0 ? (
        <p className="text-center text-muted py-10">Nada que mostrar con este filtro.</p>
      ) : (
        <div className="space-y-1">
          {meses.map(({ mes, dias }) => (
            <section key={mes} aria-label={mesAnio(`${mes}-01`)}>
              <h2 className="sticky -top-5 z-10 -mx-4 px-4 pt-3 pb-2 bg-canvas eyebrow md:mx-0 md:px-0">{mesAnio(`${mes}-01`)}</h2>
              <div className="card p-0 divide-y divide-hairline overflow-hidden">
                {dias.map((d) => <FilaDia key={d.jornada_id} d={d} />)}
              </div>
            </section>
          ))}
        </div>
      )}
      {q.hasNextPage && (
        <button type="button" className="btn-secondary w-full mt-3 min-h-[46px] rounded-[12px]" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {q.isFetchingNextPage ? 'Cargando…' : 'Ver más días'}
        </button>
      )}
    </div>
  )
}

function FilaDia({ d }: { d: VResumenDia }) {
  const dia = fechaDiaMes(d.fecha).split(' ')[0]?.replace(',', '')
  return (
    <Link to="/dia" search={{ fecha: d.fecha }} className="flex items-center gap-3 px-4 py-2.5 min-h-[72px] hover:bg-soft/60 active:bg-soft">
      <div className={`w-[46px] h-[46px] shrink-0 rounded-[10px] border border-hairline grid place-content-center text-center ${d.tiene_borrador ? 'bg-warn-tint' : 'bg-soft'}`}>
        <p className="text-[11px] leading-none font-semibold uppercase text-muted">{dia}</p>
        <p className="font-display text-lg leading-none font-semibold tabular-nums text-ink mt-[3px]">{Number(d.fecha.slice(8, 10))}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <EstadoChip estado={d.estado} />
          {d.corregido && <span className="badge bg-brand-tint text-brand">Corregido</span>}
          {d.con_descuadre && <span className="badge bg-neg-tint text-neg">Descuadre</span>}
        </div>
        {/* Bajo 390 px "proveedores" invade la columna del neto: se abrevia. */}
        <p className="text-xs text-muted tabular-nums mt-1.5 flex flex-col">
          <span className="whitespace-nowrap">{clp(d.total_ventas)} ventas</span>
          <span className="whitespace-nowrap">{clp(d.total_proveedores)} <span className="max-[389px]:hidden">proveedores</span><span className="min-[390px]:hidden">prov.</span></span>
        </p>
      </div>
      <p className="text-right shrink-0">
        <span className={`block cifra text-base min-[390px]:text-lg leading-tight ${(d.neto ?? 0) >= 0 ? 'text-ink' : 'text-neg'}`}>{clp(d.neto)}</span>
        <span className="block text-[11px] text-muted">neto</span>
      </p>
      <Icon name="chevR" className="w-[15px] h-[15px] text-muted2 shrink-0" />
    </Link>
  )
}
