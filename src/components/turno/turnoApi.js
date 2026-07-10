import { supabase } from '../../lib/supabase'
import { METODOS_VENTA } from '../TurnoInput'

const ventasPayload = (ventas) =>
  Object.fromEntries(METODOS_VENTA.map((m) => [m.key, ventas[m.key] || 0]))

const proveedoresValidos = (provs) =>
  provs.filter((p) => p.nombre.trim() && p.monto > 0)

/** Busca o crea la jornada de una fecha. Devuelve su id. */
async function ensureJornada(fecha) {
  const { data: existente } = await supabase.from('jornadas').select('id').eq('fecha', fecha).maybeSingle()
  if (existente) return existente.id
  const { data, error } = await supabase.from('jornadas').insert({ fecha }).select('id').single()
  if (error) throw error
  return data.id
}

/**
 * Garantiza que exista un turno para (fecha, tipo). Si la jornada o el
 * turno no existen, los crea (como borrador, sin ventas — eso lo
 * maneja guardarTurno por separado). Devuelve el id del turno.
 */
export async function asegurarTurno({ fecha, tipo, usuarioId, fondoInicial = 0 }) {
  const jornadaId = await ensureJornada(fecha)

  // Solo cuenta como "ya existe" un turno activo — uno eliminado (en la
  // papelera) no debe reutilizarse silenciosamente ni bloquear la creación
  // de uno nuevo para el mismo día/tipo (el índice único parcial en la
  // base de datos permite esto: solo exige unicidad entre turnos activos).
  const { data: tEx } = await supabase
    .from('turnos').select('id').eq('jornada_id', jornadaId).eq('tipo', tipo).is('deleted_at', null).maybeSingle()
  if (tEx) return tEx.id

  // fondoInicial solo aplica al crear el turno (es un valor que queda
  // fijo, "de nacimiento", igual que un snapshot — no se recalcula
  // después aunque cambie el valor por defecto en Configuración).
  const { data: turno, error: eT } = await supabase
    .from('turnos').insert({ jornada_id: jornadaId, tipo, usuario_id: usuarioId, fondo_inicial: fondoInicial }).select('id').single()
  if (eT) throw eT

  return turno.id
}

/**
 * Guarda el turno completo: lo crea si hace falta (fecha + tipo),
 * sincroniza proveedores por diferencia contra lo que ya hay en la
 * base de datos, y si se pasan ventas, las actualiza también.
 *
 * La sincronización de proveedores reemplaza el patrón anterior de
 * "borrar todos e insertar de nuevo" (usado antes en escribirTurno):
 * ahora solo se actualizan las filas que cambiaron, se insertan las
 * nuevas (id: null, o un id que ya no existe en la base — por
 * ejemplo tras un "deshacer" sobre datos que fueron reemplazados) y
 * se borran únicamente las que el usuario quitó de la lista. Si algo
 * falla a mitad de camino, el daño queda acotado a esas filas, no a
 * todos los proveedores del turno.
 *
 * Es la función que usan tanto el autoguardado de Turno.jsx (llamada
 * solo con `proveedores` cuando cambia un proveedor, solo con
 * `ventas` cuando cambia una venta — nunca toca la tabla que no le
 * corresponde) como el botón "Guardar" de Turno.jsx y de
 * EditarTurno.jsx (con ambos). Reemplaza a insertarProveedor /
 * actualizarProveedor / eliminarProveedor / escribirTurno / crearTurno.
 *
 * @param {object} datos
 * @param {string} datos.fecha
 * @param {'mañana'|'tarde'} datos.tipo
 * @param {string} datos.usuarioId - solo se usa si hay que crear el turno
 * @param {Array}  [datos.proveedores] - lista completa deseada; los
 *   que ya existen en la base de datos deben traer su `id`, los
 *   nuevos van con `id: null`. Si se omite, no se toca
 *   proveedores_turno en absoluto (autoguardado de solo ventas).
 * @param {object} [datos.ventas] - si se omite, no se toca ventas_turno
 *   (autoguardado de solo proveedores).
 * @returns {{ turnoId: string, proveedores?: Array }} el id del turno,
 *   y si se pasaron proveedores, la lista ya con sus ids reales de
 *   base de datos.
 */
export async function guardarTurno({ fecha, tipo, usuarioId, proveedores, ventas, fondoInicial }) {
  const turnoId = await asegurarTurno({ fecha, tipo, usuarioId, fondoInicial })

  let proveedoresFinal
  if (proveedores) {
    const validos = proveedoresValidos(proveedores)

    const { data: actuales, error: eSel } = await supabase
      .from('proveedores_turno').select('id').eq('turno_id', turnoId)
    if (eSel) throw eSel
    const idsActuales = new Set((actuales || []).map((r) => r.id))

    const aActualizar = []
    const aInsertar = []
    for (const p of validos) {
      if (p.id && idsActuales.has(p.id)) aActualizar.push(p)
      else aInsertar.push(p)
    }
    const idsConservados = new Set(aActualizar.map((p) => p.id))
    const idsABorrar = [...idsActuales].filter((id) => !idsConservados.has(id))

    for (const p of aActualizar) {
      const { error } = await supabase.from('proveedores_turno')
        .update({ nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago })
        .eq('id', p.id)
      if (error) throw error
    }

    let insertados = []
    if (aInsertar.length > 0) {
      const { data, error } = await supabase.from('proveedores_turno').insert(
        aInsertar.map((p) => ({ turno_id: turnoId, nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago }))
      ).select('id')
      if (error) throw error
      insertados = data
      await supabase.from('proveedores_frecuentes').upsert(
        aInsertar.map((p) => ({ nombre: p.nombre.trim() })),
        { onConflict: 'nombre', ignoreDuplicates: true }
      )
    }

    if (idsABorrar.length > 0) {
      const { error } = await supabase.from('proveedores_turno').delete().in('id', idsABorrar)
      if (error) throw error
    }

    let i = 0
    proveedoresFinal = validos.map((p) => {
      if (p.id && idsConservados.has(p.id)) return p
      const nuevo = insertados[i]
      i += 1
      return { ...p, id: nuevo?.id ?? null }
    })
  }

  if (ventas) {
    const { error } = await supabase.from('ventas_turno')
      .upsert({ turno_id: turnoId, ...ventasPayload(ventas) }, { onConflict: 'turno_id' })
    if (error) throw error
  }

  return { turnoId, proveedores: proveedoresFinal }
}

/**
 * Corrige el fondo de caja inicial de un turno ya creado (por ejemplo,
 * si ese día se abrió con un vuelto distinto al de siempre). No pasa
 * por guardarTurno porque es un dato independiente de ventas/proveedores.
 */
export async function actualizarFondoInicial(turnoId, monto) {
  const { error } = await supabase.from('turnos').update({ fondo_inicial: monto }).eq('id', turnoId)
  if (error) throw error
}

/** Lee la versión (updated_at) actual de un turno, para detectar cambios remotos. */
export async function versionTurno(turnoId) {
  const { data, error } = await supabase.from('turnos').select('updated_at').eq('id', turnoId).maybeSingle()
  if (error) throw error
  return data?.updated_at ?? null
}

/**
 * Borra un turno de verdad (hard delete). Se usa solo para "deshacer"
 * inmediatamente después de crear un turno histórico nuevo — ahí no tiene
 * sentido dejar un rastro en la papelera, porque el usuario está
 * deshaciendo su propia acción al instante, no recuperándose de un error
 * que descubrió después.
 */
export async function borrarTurno(turnoId) {
  return supabase.from('turnos').delete().eq('id', turnoId)
}

/**
 * "Eliminar turno" real (botón de basurero en Turno.jsx/EditarTurno.jsx):
 * no borra la fila, solo la marca con deleted_at. Queda disponible para
 * que el dueño la restaure desde la papelera si fue un error.
 */
export async function eliminarTurno(turnoId) {
  const { error } = await supabase.from('turnos').update({ deleted_at: new Date().toISOString() }).eq('id', turnoId)
  if (error) throw error
}

/** Restaura un turno eliminado (limpia deleted_at). Solo dueño vía RLS. */
export async function restaurarTurno(turnoId) {
  const { error } = await supabase.from('turnos').update({ deleted_at: null }).eq('id', turnoId)
  if (error) throw error
}

/** Borra definitivamente un turno de la papelera. Solo dueño vía RLS. */
export async function eliminarTurnoDefinitivo(turnoId) {
  const { error } = await supabase.from('turnos').delete().eq('id', turnoId)
  if (error) throw error
}

/**
 * Lista los turnos en la papelera (deleted_at IS NOT NULL), con su fecha,
 * tipo, quién lo registró y los totales para poder identificarlo antes de
 * restaurar o purgar.
 */
export async function listarPapelera() {
  const { data, error } = await supabase
    .from('turnos')
    .select(`
      id, tipo, deleted_at, fondo_inicial,
      usuario:usuarios(nombre),
      jornada:jornadas(fecha),
      ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
      proveedores:proveedores_turno(monto, forma_pago)
    `)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Cierra un turno: llama a la función de servidor cerrar_turno(), que
 * en una sola transacción guarda un snapshot inmutable en
 * turno_cierres (ventas + proveedores tal como quedaron) y recién
 * ahí marca is_draft: false. Reemplaza el UPDATE directo que hacía
 * esto antes — is_draft solo debe cambiar a través de esta función,
 * nunca con un update suelto desde el cliente.
 * Llamado desde el botón "Listo" de Turno.jsx, y desde EditarTurno.jsx
 * al registrar un turno histórico nuevo (que queda cerrado de una vez).
 */
export async function finalizarTurno(turnoId, efectivoContado = null) {
  const { error } = await supabase.rpc('cerrar_turno', { p_turno_id: turnoId, p_efectivo_contado: efectivoContado })
  if (error) throw error
}

/**
 * Registra una corrección sobre un turno que ya tenía un cierre
 * previo: guarda una nueva fotografía en turno_cierres encadenada a
 * la anterior, sin modificar los cierres previos. La función en el
 * servidor exige que quien llama sea el dueño. Se llama DESPUÉS de
 * guardar los datos editados (vía guardarTurno), para que la
 * fotografía capture el valor ya corregido.
 */
export async function corregirTurno(turnoId, efectivoContado = null) {
  const { error } = await supabase.rpc('corregir_turno', { p_turno_id: turnoId, p_efectivo_contado: efectivoContado })
  if (error) throw error
}
