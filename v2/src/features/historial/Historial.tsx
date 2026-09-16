import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { EstadoChip } from '@/features/hoy/Hoy'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import type { VResumenDia } from '@/features/turno/api'
import { clp, fechaDiaMes, fechaCorta } from '@/lib/format'

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

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="FrytControl" title="Historial" />
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3 md:flex-wrap md:mx-0 md:px-0" role="group" aria-label="Filtro">
        {FILTROS.map((f) => (
          <button key={f.v} type="button" aria-pressed={filtro === f.v}
            onClick={() => void navigate({ to: '/historial', search: { filtro: f.v } })}
            className={`shrink-0 min-h-[38px] rounded-full px-4 text-sm font-semibold border ${filtro === f.v ? 'bg-brand text-on-solid border-brand' : 'bg-card text-ink2 border-hairline'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {q.isPending ? <Spinner /> : filas.length === 0 ? (
        <p className="text-center text-muted py-10">Nada que mostrar con este filtro.</p>
      ) : (
        <div className="card p-0 divide-y divide-hairline overflow-hidden">
          {filas.map((d) => (
            <Link key={d.jornada_id} to="/dia" search={{ fecha: d.fecha }} className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-soft/60">
              <div className="w-[52px] shrink-0 text-center">
                <p className="text-xs font-bold uppercase text-muted">{fechaDiaMes(d.fecha).split(' ')[0]}</p>
                <p className="text-xl font-display leading-none text-ink">{fechaCorta(d.fecha).slice(0, 2)}</p>
                <p className="text-xs text-muted2">{fechaDiaMes(d.fecha).split(' ').slice(2).join(' ')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <EstadoChip estado={d.estado} />
                  {d.corregido && <span className="text-xs font-bold uppercase text-info">corregido</span>}
                  {d.con_descuadre && <span className="text-xs font-bold uppercase text-neg">descuadre</span>}
                  {d.es_dia_unico && d.turnos === 1 && <span className="text-xs font-bold uppercase text-muted2">día completo</span>}
                </div>
                <p className="text-xs text-muted mt-1">ventas {clp(d.total_ventas)} · prov. {clp(d.total_proveedores)}</p>
              </div>
              <div className="text-right">
                <p className={`cifra text-lg ${(d.neto ?? 0) >= 0 ? 'text-ink' : 'text-neg'}`}>{clp(d.neto)}</p>
                <p className="text-xs uppercase text-muted2">neto</p>
              </div>
              <Icon name="chevR" className="w-4 h-4 text-muted2 shrink-0" />
            </Link>
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
