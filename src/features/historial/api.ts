import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import type { VResumenDia } from '@/features/turno/api'

const PAGINA = 30

export type Filtro = 'todos' | 'borradores' | 'corregidos' | 'descuadres' | 'parciales' | 'sin_abrir'

/** Días de `v_resumen_dia`, del más reciente al más antiguo, de a 30 y según el filtro. */
export function useHistorial(filtro: Filtro) {
  return useInfiniteQuery({
    queryKey: qk.historial(filtro),
    initialPageParam: 0,
    getNextPageParam: (last: VResumenDia[], all) => (last.length < PAGINA ? undefined : all.length * PAGINA),
    queryFn: async ({ pageParam }): Promise<VResumenDia[]> => {
      let s = supabase.from('v_resumen_dia').select('*').order('fecha', { ascending: false }).range(pageParam, pageParam + PAGINA - 1)
      if (filtro === 'borradores') s = s.eq('tiene_borrador', true)
      if (filtro === 'corregidos') s = s.eq('corregido', true)
      if (filtro === 'descuadres') s = s.eq('con_descuadre', true)
      if (filtro === 'parciales') s = s.eq('estado', 'parcial')
      if (filtro === 'sin_abrir') s = s.eq('cerrado', true)
      const { data, error } = await s
      if (error) throw error
      return data as VResumenDia[]
    },
  })
}
