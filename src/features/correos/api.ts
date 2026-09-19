import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk, queryClient } from '@/lib/query'
import type { Json, Tables } from '@/lib/database.types'

export type Destinatario = Tables<'correo_destinatarios'>
export type TipoCorreo = 'cierre' | 'diario' | 'semanal' | 'mensual'

export const TIPOS_CORREO: { tipo: TipoCorreo; label: string; cuando: string }[] = [
  { tipo: 'cierre', label: 'Cierre', cuando: 'al cerrar cada turno' },
  { tipo: 'diario', label: 'Diario', cuando: 'cada mañana, el día anterior' },
  { tipo: 'semanal', label: 'Semanal', cuando: 'los lunes, la semana anterior' },
  { tipo: 'mensual', label: 'Mensual', cuando: 'el día 1, el mes anterior' },
]

/** Un correo mal escrito hace que el envío a esa persona falle. */
export function correoValido(c: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.trim())
}

/** Horas ofrecidas para los resúmenes (hora de Chile). */
export const HORAS_RESUMEN = [6, 7, 8, 9, 10, 11, 12, 18, 19, 20, 21, 22]

export function useDestinatarios() {
  return useQuery({
    queryKey: qk.destinatarios,
    queryFn: async (): Promise<Destinatario[]> => {
      const { data, error } = await supabase.from('correo_destinatarios').select('*').order('creado_en')
      if (error) throw error
      // Primero las cuentas, luego los correos agregados.
      return data.sort((a, b) => Number(a.usuario_id === null) - Number(b.usuario_id === null))
    },
  })
}

export async function crearDestinatario(email: string, nombre: string) {
  const { error } = await supabase.from('correo_destinatarios').insert({ email: email.trim(), nombre: nombre.trim() || null })
  if (error) throw error.code === '23505' ? new Error('Ese correo ya está en la lista.') : error
  await queryClient.invalidateQueries({ queryKey: qk.destinatarios })
}

export async function actualizarDestinatario(id: string, cambios: Partial<Pick<Destinatario, TipoCorreo | 'activo'>>) {
  // Optimista: el botón cambia al tiro; si falla, se recarga la lista.
  queryClient.setQueryData<Destinatario[]>(qk.destinatarios, (l) => l?.map((d) => (d.id === id ? { ...d, ...cambios } : d)))
  const { error } = await supabase.from('correo_destinatarios').update(cambios).eq('id', id)
  if (error) {
    await queryClient.invalidateQueries({ queryKey: qk.destinatarios })
    throw error
  }
}

export async function eliminarDestinatario(id: string) {
  const { error } = await supabase.from('correo_destinatarios').delete().eq('id', id)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.destinatarios })
}

export type AjustesCorreo = { activos: boolean; hora: number }

export function useAjustesCorreo() {
  return useQuery({
    queryKey: qk.ajustesCorreo,
    queryFn: async (): Promise<AjustesCorreo> => {
      const { data, error } = await supabase.from('configuracion').select('clave, valor').in('clave', ['notificaciones_activas', 'correos_hora'])
      if (error) throw error
      const m = Object.fromEntries(data.map((r) => [r.clave, r.valor])) as Record<string, Json>
      return { activos: m.notificaciones_activas !== false, hora: typeof m.correos_hora === 'number' ? m.correos_hora : 8 }
    },
  })
}

export async function guardarAjusteCorreo(cambio: Partial<AjustesCorreo>) {
  const filas: { clave: string; valor: Json }[] = []
  if (cambio.activos !== undefined) filas.push({ clave: 'notificaciones_activas', valor: cambio.activos })
  if (cambio.hora !== undefined) filas.push({ clave: 'correos_hora', valor: cambio.hora })
  queryClient.setQueryData<AjustesCorreo>(qk.ajustesCorreo, (a) => (a ? { ...a, ...cambio } : a))
  const { error } = await supabase.from('configuracion').upsert(filas, { onConflict: 'clave' })
  if (error) {
    await queryClient.invalidateQueries({ queryKey: qk.ajustesCorreo })
    throw error
  }
}

export async function enviarPrueba(tipo: TipoCorreo) {
  const { error } = await supabase.rpc('enviar_correo_prueba', { p_tipo: tipo })
  if (error) throw error
}
