import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk, queryClient, invalidarDia } from '@/lib/query'
import type { Tables, Json } from '@/lib/database.types'
import type { FormaPago, MetodoKey, ProveedorLinea } from '@/lib/totales'

export type Modo = 'completo' | 'mañana' | 'tarde'
export const MODOS: { value: Modo; label: string; icon: 'sun' | 'moon' | 'calendar' }[] = [
  { value: 'completo', label: 'Día completo', icon: 'calendar' },
  { value: 'mañana', label: 'Mañana', icon: 'sun' },
  { value: 'tarde', label: 'Tarde', icon: 'moon' },
]

export { etiquetaModo } from './modo'

/** Fila de v_turnos con los campos que la vista garantiza no nulos. */
export type VTurno = Omit<Tables<'v_turnos'>, 'id' | 'fecha' | 'tipo' | 'modo' | 'is_draft' | 'jornada_id'> & {
  id: string
  fecha: string
  tipo: 'mañana' | 'tarde'
  modo: Modo
  is_draft: boolean
  jornada_id: string
}
export type VResumenDia = Tables<'v_resumen_dia'> & { fecha: string; jornada_id: string; estado: 'sin_registro' | 'borrador' | 'parcial' | 'completo' }
export type ProveedorTurno = Tables<'proveedores_turno'>
export type Cierre = Tables<'turno_cierres'> & { cerrado_por_usuario: { nombre: string } | null }

export interface TurnoConLineas {
  turno: VTurno
  proveedores: ProveedorTurno[]
}

const TURNO_ORDEN: Record<string, number> = { 'mañana': 0, 'tarde': 1 }

/* ───────── lecturas ───────── */
export function useResumenDia(fecha: string) {
  return useQuery({
    queryKey: qk.resumenDia(fecha),
    queryFn: async (): Promise<VResumenDia | null> => {
      const { data, error } = await supabase.from('v_resumen_dia').select('*').eq('fecha', fecha).maybeSingle()
      if (error) throw error
      return (data as VResumenDia | null) ?? null
    },
  })
}

export async function cargarTurnosDia(fecha: string): Promise<TurnoConLineas[]> {
  const { data: turnos, error } = await supabase.from('v_turnos').select('*').eq('fecha', fecha)
  if (error) throw error
  const ids = turnos.map((t) => t.id).filter((x): x is string => !!x)
  let lineas: ProveedorTurno[] = []
  if (ids.length) {
    const { data, error: e2 } = await supabase.from('proveedores_turno').select('*').in('turno_id', ids).order('creado_en')
    if (e2) throw e2
    lineas = data
  }
  return (turnos as VTurno[])
    .sort((a, b) => (TURNO_ORDEN[a.tipo] ?? 0) - (TURNO_ORDEN[b.tipo] ?? 0))
    .map((turno) => ({ turno, proveedores: lineas.filter((l) => l.turno_id === turno.id) }))
}

export function useTurnosDia(fecha: string) {
  return useQuery({ queryKey: qk.turnosDia(fecha), queryFn: () => cargarTurnosDia(fecha) })
}

/** Borradores de cualquier fecha (los "turnos olvidados"). */
export function useBorradores() {
  return useQuery({
    queryKey: qk.borradores,
    queryFn: async (): Promise<VTurno[]> => {
      const { data, error } = await supabase.from('v_turnos').select('*').eq('is_draft', true).order('fecha', { ascending: false })
      if (error) throw error
      return data as VTurno[]
    },
  })
}

export function useCierres(turnoId: string | null) {
  return useQuery({
    queryKey: qk.cierresTurno(turnoId ?? ''),
    enabled: !!turnoId,
    queryFn: async (): Promise<Cierre[]> => {
      const { data, error } = await supabase
        .from('turno_cierres')
        .select('*, cerrado_por_usuario:usuarios!turno_cierres_cerrado_por_fkey(nombre)')
        .eq('turno_id', turnoId!)
        .order('cerrado_en')
      if (error) throw error
      return data
    },
  })
}

/* ───────── guardar_turno ───────── */
export interface GuardarTurnoInput {
  fecha: string
  modo: Modo
  trabajador_id?: string | null
  fondo_inicial?: number
  ventas?: Partial<Record<MetodoKey, number>>
  proveedores?: ProveedorLinea[]
  cerrar?: boolean
  efectivo_contado?: number | null
  base_updated_at?: string | null
}

export type GuardarTurnoResultado =
  | { conflicto: false; turno: VTurno }
  | { conflicto: true; actual: VTurno }

export class ErrorGuardado extends Error {
  code: string
  constructor(message: string, code: string) { super(message); this.code = code }
}

/**
 * Una llamada, una transacción. Errores esperables (con código Postgres):
 *   23514 check_violation      → regla de modo (tarde en día completo, etc.)
 *   42501 insufficient_privilege → sin permiso (turno cerrado, sesión)
 */
export async function guardarTurno(input: GuardarTurnoInput): Promise<GuardarTurnoResultado> {
  const p: Record<string, Json> = {
    fecha: input.fecha,
    modo: input.modo,
    cerrar: !!input.cerrar,
  }
  if (input.trabajador_id !== undefined) p.trabajador_id = input.trabajador_id
  if (input.fondo_inicial !== undefined) p.fondo_inicial = input.fondo_inicial
  if (input.ventas) p.ventas = input.ventas
  if (input.proveedores) {
    p.proveedores = input.proveedores.map((l) => ({
      id: l.id ?? null, proveedor_id: l.proveedor_id ?? null, nombre: l.nombre, monto: l.monto, forma_pago: l.forma_pago,
    }))
  }
  if (input.efectivo_contado !== undefined) p.efectivo_contado = input.efectivo_contado
  if (input.base_updated_at) p.base_updated_at = input.base_updated_at

  const { data, error } = await supabase.rpc('guardar_turno', { p })
  if (error) throw new ErrorGuardado(error.message, error.code ?? '')
  const r = data as { conflicto?: boolean; actual?: VTurno } | VTurno
  if (r && typeof r === 'object' && 'conflicto' in r && r.conflicto) {
    return { conflicto: true, actual: (r as { actual: VTurno }).actual }
  }
  invalidarDia(input.fecha)
  return { conflicto: false, turno: r as VTurno }
}

/* ───────── papelera (soft delete) ───────── */
export async function eliminarTurno(turnoId: string, fecha: string) {
  const { error } = await supabase.from('turnos').update({ deleted_at: new Date().toISOString() }).eq('id', turnoId)
  if (error) throw error
  invalidarDia(fecha)
  await queryClient.invalidateQueries({ queryKey: qk.papelera })
}

export async function restaurarTurno(turnoId: string, fecha: string) {
  const { error } = await supabase.from('turnos').update({ deleted_at: null }).eq('id', turnoId)
  if (error) throw error
  invalidarDia(fecha)
  await queryClient.invalidateQueries({ queryKey: qk.papelera })
}

export async function purgarTurno(turnoId: string) {
  const { error } = await supabase.from('turnos').delete().eq('id', turnoId)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.papelera })
}

export interface TurnoPapelera {
  id: string
  tipo: string
  deleted_at: string
  is_draft: boolean
  jornada: { fecha: string; es_turno_unico: boolean } | null
  ventas: { efectivo: number; getnet: number; mercadopago: number; edenred: number; amipass: number; transferencia: number } | null
}

export function usePapelera() {
  return useQuery({
    queryKey: qk.papelera,
    queryFn: async (): Promise<TurnoPapelera[]> => {
      const { data, error } = await supabase
        .from('turnos')
        .select('id, tipo, deleted_at, is_draft, jornada:jornadas(fecha, es_turno_unico), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/* ───────── helpers ───────── */
export function formaPago(v: string): FormaPago {
  return v === 'transferencia' ? 'transferencia' : 'efectivo'
}
