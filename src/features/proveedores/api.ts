import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import { agruparCompras, type ComprasPorProveedor } from './filtros'
import { comprasDelProveedor, type FilaCompra } from './detalle'

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

/**
 * Todas las compras de un proveedor, sin las de turnos en la papelera. Antes
 * se cortaba en 100 filas antes de quitar la papelera y la suma de lo
 * cargado se mostraba como «en total»; ahora se pagina hasta el final.
 */
export function useComprasProveedor(id: string) {
  return useQuery({
    queryKey: qk.proveedorHistorial(id),
    queryFn: async () => {
      const filas: FilaCompra[] = []
      for (;;) {
        const { data, error } = await supabase
          .from('proveedores_turno')
          .select('id, monto, forma_pago, creado_en, turno:turnos!proveedores_turno_turno_id_fkey!inner(tipo, deleted_at, jornada:jornadas!inner(fecha, es_turno_unico))')
          .eq('proveedor_id', id)
          .is('turno.deleted_at', null)
          .order('id')
          .range(filas.length, filas.length + PAGINA - 1)
        if (error) throw error
        if (data.length === 0) break
        filas.push(...(data as unknown as FilaCompra[]))
      }
      return comprasDelProveedor(filas)
    },
  })
}
