import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import type { Resumen } from '@/features/exportar/tablas'

/**
 * `resumen_periodo`: los días del rango, los totales, los del período
 * anterior (para las variaciones) y el top de proveedores, en una llamada.
 * Lo usan la pantalla de Análisis y el reporte imprimible.
 */
export function useResumenPeriodo(desde: string, hasta: string) {
  return useQuery({
    queryKey: qk.resumenPeriodo(desde, hasta),
    queryFn: async (): Promise<Resumen> => {
      const { data, error } = await supabase.rpc('resumen_periodo', { p_desde: desde, p_hasta: hasta })
      if (error) throw error
      // El RPC devuelve json: su forma la fija `tablas.ts`, no los tipos generados.
      return data as unknown as Resumen
    },
  })
}
