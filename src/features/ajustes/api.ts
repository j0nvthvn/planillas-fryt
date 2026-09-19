import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk, queryClient } from '@/lib/query'
import { mensajeDeError } from '@/lib/errorLog'
import { leerMetricas } from '@/features/turno/metricas'

/** Cuentas con acceso a la app (no confundir con `trabajadores`, que no tienen cuenta). */
export function useUsuarios() {
  return useQuery({
    queryKey: qk.usuarios,
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('*').order('creado_en')
      if (error) throw error
      return data
    },
  })
}

export async function actualizarUsuario(id: string, cambios: { activo: boolean }) {
  const { error } = await supabase.from('usuarios').update(cambios).eq('id', id)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.usuarios })
}

export interface NuevaCuenta {
  nombre: string
  email: string
  password: string
}

/** La crea la edge function `crear-usuario` (necesita service-role). */
export async function crearUsuario(cuenta: NuevaCuenta) {
  // `invoke` devuelve el error sin tipo: se normaliza a Error.
  const r = await supabase.functions.invoke<{ error?: string }>('crear-usuario', { body: cuenta })
  if (r.error) throw r.error instanceof Error ? r.error : new Error(mensajeDeError(r.error))
  if (r.data?.error) throw new Error(r.data.error)
  await queryClient.invalidateQueries({ queryKey: qk.usuarios })
}

export function useLogsError() {
  return useQuery({
    queryKey: qk.errores,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs_error')
        .select('id, created_at, mensaje, contexto, ruta')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
  })
}

/** Tiempos de cierre medidos en este dispositivo (IndexedDB, no viajan). */
export function useMetricasCierre() {
  return useQuery({ queryKey: qk.metricasCierre, queryFn: leerMetricas, staleTime: 0, gcTime: 0 })
}
