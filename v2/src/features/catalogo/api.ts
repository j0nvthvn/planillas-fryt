import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk, queryClient } from '@/lib/query'
import type { Tables, Json } from '@/lib/database.types'

export type MetodoPago = Tables<'metodos_pago'>
export type Trabajador = Tables<'trabajadores'>
export type Proveedor = Tables<'proveedores_frecuentes'> & { usos: number }

/* ───────── métodos de pago ───────── */
export function useMetodos(soloActivos = true) {
  return useQuery({
    queryKey: [...qk.metodos, soloActivos],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<MetodoPago[]> => {
      let q = supabase.from('metodos_pago').select('*').order('orden')
      if (soloActivos) q = q.eq('activo', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export async function actualizarMetodo(key: string, cambios: Partial<Pick<MetodoPago, 'label' | 'sub' | 'orden' | 'activo' | 'color'>>) {
  const { error } = await supabase.from('metodos_pago').update(cambios).eq('key', key)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.metodos })
}

/* ───────── trabajadores ───────── */
export function useTrabajadores(soloActivos = true) {
  return useQuery({
    queryKey: [...qk.trabajadores, soloActivos],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<Trabajador[]> => {
      let q = supabase.from('trabajadores').select('*').order('orden').order('nombre')
      if (soloActivos) q = q.eq('activo', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export async function crearTrabajador(nombre: string) {
  const { error } = await supabase.from('trabajadores').insert({ nombre: nombre.trim() })
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.trabajadores })
}

export async function actualizarTrabajador(id: string, cambios: Partial<Pick<Trabajador, 'nombre' | 'activo' | 'orden'>>) {
  const { error } = await supabase.from('trabajadores').update(cambios).eq('id', id)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.trabajadores })
}

export async function eliminarTrabajador(id: string) {
  const { error } = await supabase.from('trabajadores').delete().eq('id', id)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.trabajadores })
}

/* ───────── catálogo de proveedores ───────── */
/**
 * Catálogo completo + cuántas veces se usó cada proveedor en los últimos
 * ~400 registros (para ordenar el buscador por frecuencia real).
 */
export function useCatalogo() {
  return useQuery({
    queryKey: qk.catalogo,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Proveedor[]> => {
      const [cat, usos] = await Promise.all([
        supabase.from('proveedores_frecuentes').select('*').order('nombre'),
        supabase.from('proveedores_turno').select('proveedor_id').order('creado_en', { ascending: false }).limit(400),
      ])
      if (cat.error) throw cat.error
      if (usos.error) throw usos.error
      const conteo = new Map<string, number>()
      for (const u of usos.data) if (u.proveedor_id) conteo.set(u.proveedor_id, (conteo.get(u.proveedor_id) ?? 0) + 1)
      return cat.data.map((p) => ({ ...p, usos: conteo.get(p.id) ?? 0 }))
    },
  })
}

export async function crearProveedor(nombre: string): Promise<Tables<'proveedores_frecuentes'>> {
  const { data, error } = await supabase.from('proveedores_frecuentes').insert({ nombre: nombre.trim() }).select().maybeSingle()
  if (error) throw error
  if (!data) {
    // El trigger descartó el insert: ya existe con otra grafía. Se devuelve ese.
    const { data: ex, error: e2 } = await supabase.rpc('norm_nombre', { p: nombre })
    if (e2) throw e2
    const { data: fila, error: e3 } = await supabase.from('proveedores_frecuentes').select('*').eq('nombre_norm', ex).single()
    if (e3) throw e3
    await queryClient.invalidateQueries({ queryKey: qk.catalogo })
    return fila
  }
  await queryClient.invalidateQueries({ queryKey: qk.catalogo })
  return data
}

export async function actualizarProveedor(id: string, cambios: Partial<Pick<Tables<'proveedores_frecuentes'>, 'nombre' | 'activo' | 'imagen_url'>>) {
  const { error } = await supabase.from('proveedores_frecuentes').update(cambios).eq('id', id)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.catalogo })
}

export async function eliminarProveedor(id: string) {
  const { error } = await supabase.from('proveedores_frecuentes').delete().eq('id', id)
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.catalogo })
}

export async function fusionarProveedores(origen: string, destino: string) {
  const { error } = await supabase.rpc('fusionar_proveedores', { p_origen: origen, p_destino: destino })
  if (error) throw error
  await queryClient.invalidateQueries({ queryKey: qk.catalogo })
  await queryClient.invalidateQueries({ queryKey: ['proveedor-historial'] })
}

export async function subirLogo(proveedorId: string, nombre: string, archivo: File): Promise<string> {
  const ext = (archivo.name.split('.').pop() || 'png').toLowerCase()
  const slug = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const path = `${slug || 'logo'}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('logos-proveedores').upload(path, archivo, { contentType: archivo.type || undefined, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('logos-proveedores').getPublicUrl(path)
  await actualizarProveedor(proveedorId, { imagen_url: data.publicUrl })
  return data.publicUrl
}

/* ───────── configuración ───────── */
export interface Config {
  diasTurnoUnico: number[]
  horaCorteManana: number
  nombreLocal: string
  fondoCajaInicial: number
  notificacionesActivas: boolean
  notificacionesEmailExtra: string
}

export const CONFIG_DEFAULT: Config = {
  diasTurnoUnico: [0],
  horaCorteManana: 14,
  nombreLocal: 'Fryt',
  fondoCajaInicial: 0,
  notificacionesActivas: true,
  notificacionesEmailExtra: '',
}

function leerConfig(filas: { clave: string; valor: Json }[]): Config {
  const m = Object.fromEntries(filas.map((r) => [r.clave, r.valor])) as Record<string, Json>
  return {
    diasTurnoUnico: Array.isArray(m.dias_turno_unico) ? (m.dias_turno_unico as unknown[]).filter((x): x is number => typeof x === 'number') : CONFIG_DEFAULT.diasTurnoUnico,
    horaCorteManana: typeof m.hora_corte_manana === 'number' ? m.hora_corte_manana : CONFIG_DEFAULT.horaCorteManana,
    nombreLocal: typeof m.nombre_local === 'string' && m.nombre_local ? m.nombre_local : CONFIG_DEFAULT.nombreLocal,
    fondoCajaInicial: typeof m.fondo_caja_inicial === 'number' ? m.fondo_caja_inicial : CONFIG_DEFAULT.fondoCajaInicial,
    notificacionesActivas: m.notificaciones_activas !== false,
    notificacionesEmailExtra: typeof m.notificaciones_email_extra === 'string' ? m.notificaciones_email_extra : '',
  }
}

export function useConfig() {
  const q = useQuery({
    queryKey: qk.config,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<Config> => {
      const { data, error } = await supabase.from('configuracion').select('clave, valor')
      if (error) throw error
      return leerConfig(data)
    },
  })
  return { config: q.data ?? CONFIG_DEFAULT, cargando: q.isPending, error: q.error }
}

export function useGuardarConfig() {
  return useMutation({
    mutationFn: async (c: Config) => {
      const filas = [
        { clave: 'dias_turno_unico', valor: c.diasTurnoUnico as unknown as Json },
        { clave: 'hora_corte_manana', valor: c.horaCorteManana },
        { clave: 'nombre_local', valor: c.nombreLocal || CONFIG_DEFAULT.nombreLocal },
        { clave: 'fondo_caja_inicial', valor: c.fondoCajaInicial ?? 0 },
        { clave: 'notificaciones_activas', valor: c.notificacionesActivas },
        { clave: 'notificaciones_email_extra', valor: c.notificacionesEmailExtra || '' },
      ]
      const { error } = await supabase.from('configuracion').upsert(filas, { onConflict: 'clave' })
      if (error) throw error
      return c
    },
    onSuccess: (c) => {
      queryClient.setQueryData(qk.config, c)
      void queryClient.invalidateQueries({ queryKey: ['resumen-dia'] })
      void queryClient.invalidateQueries({ queryKey: ['historial'] })
    },
  })
}
