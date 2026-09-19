import { get, set } from 'idb-keyval'

/**
 * Tiempo de cierre: cuánto pasa entre el primer dato escrito y el cierre
 * exitoso. Es uno de los criterios de salida del piloto (Fase 3) y queda
 * solo en este dispositivo (Ajustes → General lo muestra).
 */
export interface MetricaCierre { fecha: string; modo: string; segundos: number; en: string }

const KEY = 'metricas:cierres'
const inicio = new Map<string, number>()

export function marcarInicio(clave: string) {
  if (!inicio.has(clave)) inicio.set(clave, Date.now())
}

export async function registrarCierre(clave: string, fecha: string, modo: string): Promise<void> {
  const t0 = inicio.get(clave)
  inicio.delete(clave)
  if (!t0) return
  const m: MetricaCierre = { fecha, modo, segundos: Math.round((Date.now() - t0) / 1000), en: new Date().toISOString() }
  try {
    const lista = (await get<MetricaCierre[]>(KEY)) ?? []
    await set(KEY, [m, ...lista].slice(0, 50))
  } catch { /* sin storage */ }
}

export async function leerMetricas(): Promise<MetricaCierre[]> {
  try { return (await get<MetricaCierre[]>(KEY)) ?? [] } catch { return [] }
}
