import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

/**
 * Caché de datos persistida en IndexedDB: las pantallas abren al instante
 * con lo último que se vio y se refrescan al volver a la app
 * (refetchOnWindowFocus) en vez de usar realtime. Subir PERSIST_BUSTER
 * invalida todo lo guardado (por ejemplo, si cambia la forma de una vista).
 */
export const PERSIST_BUSTER = 'v2-2'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: (count, err) => {
        // Sin sesión o sin permiso: reintentar no ayuda.
        const status = (err as { status?: number } | null)?.status
        if (status === 401 || status === 403) return false
        return count < 2
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
})

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get<string>(k).then((v) => v ?? null),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
  key: 'frytcontrol-v2-query',
  throttleTime: 1000,
})

/** Llaves de consulta centralizadas (una fuente de verdad para invalidar). */
export const qk = {
  usuario: (id: string) => ['usuario', id] as const,
  config: ['config'] as const,
  metodos: ['metodos'] as const,
  trabajadores: ['trabajadores'] as const,
  catalogo: ['catalogo'] as const,
  resumenDia: (fecha: string) => ['resumen-dia', fecha] as const,
  turnosDia: (fecha: string) => ['turnos-dia', fecha] as const,
  cierresTurno: (turnoId: string) => ['cierres', turnoId] as const,
  borradores: ['borradores'] as const,
  historial: (filtro: string) => ['historial', filtro] as const,
  resumenPeriodo: (desde: string, hasta: string) => ['resumen-periodo', desde, hasta] as const,
  exportacion: (desde: string, hasta: string) => ['exportacion', desde, hasta] as const,
  proveedorHistorial: (id: string) => ['proveedor-historial', id] as const,
  papelera: ['papelera'] as const,
  usuarios: ['usuarios'] as const,
  errores: ['errores'] as const,
  destinatarios: ['destinatarios'] as const,
  ajustesCorreo: ['ajustes-correo'] as const,
}

/** Después de guardar un turno: todo lo que muestra ese día y agregados. */
export function invalidarDia(fecha: string) {
  void queryClient.invalidateQueries({ queryKey: qk.resumenDia(fecha) })
  void queryClient.invalidateQueries({ queryKey: qk.turnosDia(fecha) })
  void queryClient.invalidateQueries({ queryKey: ['historial'] })
  void queryClient.invalidateQueries({ queryKey: ['resumen-periodo'] })
  void queryClient.invalidateQueries({ queryKey: ['exportacion'] })
  void queryClient.invalidateQueries({ queryKey: qk.borradores })
  void queryClient.invalidateQueries({ queryKey: qk.catalogo })
}
