import { supabase } from '../../lib/supabase'
import { METODOS_VENTA } from '../TurnoInput'

const ventasPayload = (ventas) =>
  Object.fromEntries(METODOS_VENTA.map((m) => [m.key, ventas[m.key] || 0]))

const proveedoresValidos = (provs) =>
  provs.filter((p) => p.nombre.trim() && p.monto > 0)

/**
 * Reemplaza ventas + proveedores de un turno existente.
 * También sirve para "deshacer" una edición re-escribiendo el snapshot previo.
 */
export async function escribirTurno(turnoId, provs, ventas) {
  const { error: eV } = await supabase.from('ventas_turno').update(ventasPayload(ventas)).eq('turno_id', turnoId)
  if (eV) throw eV
  const { error: eD } = await supabase.from('proveedores_turno').delete().eq('turno_id', turnoId)
  if (eD) throw eD
  const validos = proveedoresValidos(provs)
  if (validos.length > 0) {
    const { error: eP } = await supabase.from('proveedores_turno').insert(
      validos.map((p) => ({ turno_id: turnoId, nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago }))
    )
    if (eP) throw eP
  }
}

/**
 * Crea jornada (si falta), turno, proveedores (+frecuentes) y ventas.
 * Devuelve el id del turno creado.
 */
export async function crearTurno({ fecha, tipo, usuarioId, provs, ventas }) {
  let jornadaId
  const { data: jEx } = await supabase.from('jornadas').select('id').eq('fecha', fecha).maybeSingle()
  if (jEx) jornadaId = jEx.id
  else {
    const { data: nueva, error } = await supabase.from('jornadas').insert({ fecha }).select('id').single()
    if (error) throw error
    jornadaId = nueva.id
  }

  const { data: turno, error: eT } = await supabase
    .from('turnos').insert({ jornada_id: jornadaId, tipo, usuario_id: usuarioId }).select('id').single()
  if (eT) throw eT

  const validos = proveedoresValidos(provs)
  if (validos.length > 0) {
    const { error: eP } = await supabase.from('proveedores_turno').insert(
      validos.map((p) => ({ turno_id: turno.id, nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago }))
    )
    if (eP) throw eP
    await supabase.from('proveedores_frecuentes').upsert(
      validos.map((p) => ({ nombre: p.nombre.trim() })),
      { onConflict: 'nombre', ignoreDuplicates: true }
    )
  }

  const { error: eV } = await supabase.from('ventas_turno').insert({ turno_id: turno.id, ...ventasPayload(ventas) })
  if (eV) throw eV

  return turno.id
}

/** Lee la versión (updated_at) actual de un turno, para detectar cambios remotos. */
export async function versionTurno(turnoId) {
  const { data, error } = await supabase.from('turnos').select('updated_at').eq('id', turnoId).maybeSingle()
  if (error) throw error
  return data?.updated_at ?? null
}

/** Borra un turno (usado por "deshacer" tras crear uno nuevo). */
export async function borrarTurno(turnoId) {
  return supabase.from('turnos').delete().eq('id', turnoId)
}
