import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import type { VTurno } from '@/features/turno/api'
import type { Compra, MetodoInfo } from './tablas'

export interface DatosExportacion {
  turnos: VTurno[]
  compras: Compra[]
  metodos: MetodoInfo[]
}

// PostgREST devuelve como máximo 1000 filas por consulta.
const PAGINA = 1000
// Ids por consulta de compras: con 50 la URL no crece de más.
const LOTE = 50

export const opcionesDatos = (desde: string, hasta: string) => ({
  queryKey: qk.exportacion(desde, hasta),
  queryFn: () => cargarExportacion(desde, hasta),
  staleTime: 30_000,
  // Puede ser grande: no vale la pena guardarlo mucho tiempo en IndexedDB.
  gcTime: 5 * 60_000,
})

/** Turnos y compras del período (lo que no trae `resumen_periodo`). */
export function useDatosExportacion(desde: string, hasta: string) {
  return useQuery(opcionesDatos(desde, hasta))
}

const ORDEN_TURNO: Record<string, number> = { 'mañana': 0, 'tarde': 1 }

/**
 * Todo lo que no trae `resumen_periodo`: los turnos del período (sin los
 * eliminados, que `v_turnos` ya excluye), sus compras a proveedores con el
 * nombre del catálogo y todos los métodos de pago (también los inactivos).
 */
export async function cargarExportacion(desde: string, hasta: string): Promise<DatosExportacion> {
  const [turnos, metodos] = await Promise.all([cargarTurnos(desde, hasta), cargarMetodos()])
  const porId = new Map(turnos.map((t) => [t.id, t]))
  const compras: (Compra & { orden: string })[] = []
  for (let i = 0; i < turnos.length; i += LOTE) {
    const ids = turnos.slice(i, i + LOTE).map((t) => t.id)
    const { data, error } = await supabase
      .from('proveedores_turno')
      .select('turno_id, nombre, monto, forma_pago, creado_en, catalogo:proveedores_frecuentes(nombre)')
      .in('turno_id', ids)
    if (error) throw error
    for (const p of data) {
      const t = porId.get(p.turno_id)
      if (!t) continue
      compras.push({ fecha: t.fecha, modo: t.modo, proveedor: p.catalogo?.nombre ?? p.nombre, forma_pago: p.forma_pago, monto: Number(p.monto), orden: `${t.fecha}|${ORDEN_TURNO[t.tipo] ?? 9}|${p.creado_en}` })
    }
  }
  compras.sort((a, b) => a.orden.localeCompare(b.orden))
  return { turnos, compras: compras.map(({ orden: _, ...c }) => c), metodos }
}

async function cargarTurnos(desde: string, hasta: string): Promise<VTurno[]> {
  const filas: VTurno[] = []
  for (let desdeFila = 0; ; desdeFila += PAGINA) {
    const { data, error } = await supabase
      .from('v_turnos')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
      .order('tipo')
      .range(desdeFila, desdeFila + PAGINA - 1)
    if (error) throw error
    filas.push(...(data as VTurno[]))
    if (data.length < PAGINA) break
  }
  // "tipo" ordena alfabéticamente (mañana < tarde), pero se asegura igual.
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || (ORDEN_TURNO[a.tipo] ?? 9) - (ORDEN_TURNO[b.tipo] ?? 9))
}

async function cargarMetodos(): Promise<MetodoInfo[]> {
  const { data, error } = await supabase.from('metodos_pago').select('key, label, activo').order('orden')
  if (error) throw error
  return data
}
