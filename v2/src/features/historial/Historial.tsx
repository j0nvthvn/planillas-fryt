import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { EstadoChip } from '@/features/hoy/Hoy'
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
      <PageHeader eyebrow="FrytControl" title="Historial" />
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3 md:flex-wrap md:mx-0 md:px-0" role="group" aria-label="Filtro">
        {FILTROS.map((f) => (
          <button key={f.v} type="button" aria-pressed={filtro === f.v}
            onClick={() => void navigate({ to: '/historial', search: { filtro: f.v } })}
            className={`shrink-0 min-h-[40px] rounded-full px-4 text-sm font-semibold border ${filtro === f.v ? 'bg-brand text-on-solid border-brand' : 'bg-card text-ink2 border-hairline'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {q.isPending ? <Spinner /> : filas.length === 0 ? (
        <p className="text-center text-muted py-10">Nada que mostrar con este filtro.</p>
      ) : (
        <div className="space-y-2">
          {meses.map(({ mes, dias }) => (
            <section key={mes} aria-label={mesAnio(`${mes}-01`)}>
              <h2 className="sticky -top-5 z-10 -mx-4 px-5 pt-3 pb-2 bg-canvas/95 backdrop-blur eyebrow md:mx-0 md:px-1">{mesAnio(`${mes}-01`)}</h2>
              <div className="card p-0 divide-y divide-hairline overflow-hidden">
                {dias.map((d) => <FilaDia key={d.jornada_id} d={d} />)}
              </div>
            </section>
          ))}
        </div>
      )}
      {q.hasNextPage && (
        <button type="button" className="btn-secondary w-full mt-3" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {q.isFetchingNextPage ? 'Cargando…' : 'Ver más días'}
        </button>
      )}
    </div>
  )
}

function FilaDia({ d }: { d: VResumenDia }) {
  const [dia, , mes] = fechaDiaMes(d.fecha).split(' ')
  return (
    <Link to="/dia" search={{ fecha: d.fecha }} className="flex items-center gap-2.5 min-[390px]:gap-3 px-4 py-3 min-h-[64px] hover:bg-soft/60">
      <div className="w-10 shrink-0 text-center">
        <p className="text-xs font-bold uppercase text-muted">{dia?.replace(',', '')}</p>
        <p className="text-xl font-display leading-none text-ink">{Number(d.fecha.slice(8, 10))}</p>
        <p className="text-xs text-muted2">{mes}</p>
      </div>
      {/* Etiquetas arriba a todo lo ancho y montos abajo: en 375 px "Falta la tarde" chocaba con el neto. */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
          <EstadoChip estado={d.estado} />
          {d.corregido && <span className="text-xs font-bold uppercase text-info">corregido</span>}
          {d.con_descuadre && <span className="text-xs font-bold uppercase text-neg">descuadre</span>}
        </div>
        <div className="flex items-end justify-between gap-2 mt-1">
          <p className="text-xs text-muted flex flex-col tabular-nums">
            <span className="whitespace-nowrap">ventas {clp(d.total_ventas)}</span>
            <span className="whitespace-nowrap">prov. {clp(d.total_proveedores)}</span>
          </p>
          <p className="text-right shrink-0">
            <span className={`block cifra text-base min-[390px]:text-lg leading-tight ${(d.neto ?? 0) >= 0 ? 'text-ink' : 'text-neg'}`}>{clp(d.neto)}</span>
            <span className="block text-xs uppercase text-muted2">neto</span>
          </p>
        </div>
      </div>
      <Icon name="chevR" className="w-4 h-4 text-muted2 shrink-0" />
    </Link>
  )
}
