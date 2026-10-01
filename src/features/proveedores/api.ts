import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import { agruparCompras, type ComprasPorProveedor } from './filtros'

const PAGINA = 1000

/**
 * Compras y monto por proveedor en un rango de fechas de jornada, sin los
 * turnos en la papelera (el mismo criterio que el top de `resumen_periodo`).
 * Pagina hasta una página vacía: no depende del tope de filas de la API.
 */
export function useComprasPeriodo(desde: string, hasta: string) {
  return useQuery({
    queryKey: qk.comprasProveedores(desde, hasta),
    // Al cambiar de período la lista sigue a la vista mientras llegan los números nuevos.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ComprasPorProveedor> => {
      const filas: { proveedor_id: string | null; monto: number }[] = []
      for (;;) {
        const { data, error } = await supabase
          .from('proveedores_turno')
          .select('proveedor_id, monto, turno:turnos!proveedores_turno_turno_id_fkey!inner(deleted_at, jornada:jornadas!inner(fecha))')
          .not('proveedor_id', 'is', null)
          .is('turno.deleted_at', null)
          .gte('turno.jornada.fecha', desde)
          .lte('turno.jornada.fecha', hasta)
          .order('id')
          .range(filas.length, filas.length + PAGINA - 1)
        if (error) throw error
        if (data.length === 0) break
        filas.push(...data)
      }
      return agruparCompras(filas)
    },
  })
}
