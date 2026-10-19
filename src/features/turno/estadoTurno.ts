import type { TurnoConLineas, VTurno } from './api'
import type { BorradorLocal } from './borradorLocal'
import type { Conteo } from './conteo'
import { METODO_KEYS, VENTAS_VACIAS, type MetodoKey, type ProveedorLinea, type Ventas } from '@/lib/totales'
import { toNum } from '@/lib/format'
import { normalizar } from './parecido'

/**
 * Estado del formulario de cierre, sin React: el reducer, los dos orígenes
 * de datos (servidor y borrador del dispositivo) y las reglas que deciden
 * cuál gana y cuándo hay algo que mandar. `useTurnoForm` solo lo conecta
 * con los efectos, los timers y la red.
 */

export interface LineaForm extends ProveedorLinea {
  /** id local estable para la lista (las filas nuevas no tienen id de base). */
  key: string
}

export interface FormState {
  cargado: boolean
  turnoId: string | null
  /** El turno existe en la base y ya no es borrador. */
  cerrado: boolean
  baseUpdatedAt: string | null
  trabajadorId: string | null
  fondoInicial: number
  ventas: Ventas
  proveedores: LineaForm[]
  contoCaja: boolean
  efectivoContado: number | null
  /** Desglose por denominaciones, solo local (ver borradorLocal). */
  desgloseConteo: Conteo | null
  /** Hubo cambios desde la última sincronización con el servidor. */
  sucio: boolean
}

export type Accion =
  | { type: 'cargar'; state: Partial<FormState> }
  | { type: 'venta'; key: MetodoKey; monto: number }
  | { type: 'proveedor'; linea: LineaForm }
  | { type: 'quitarProveedor'; key: string }
  | { type: 'trabajador'; id: string | null }
  | { type: 'fondo'; monto: number }
  | { type: 'caja'; conto: boolean; monto: number | null; desglose?: Conteo | null }
  | { type: 'sincronizado'; turno: VTurno; sucio: boolean }
  /** Ids de base para líneas nuevas, por `key`. No ensucia ni cambia la `key`. */
  | { type: 'idsLineas'; ids: Record<string, string> }

export const inicial: FormState = {
  cargado: false, turnoId: null, cerrado: false, baseUpdatedAt: null, trabajadorId: null, fondoInicial: 0,
  ventas: { ...VENTAS_VACIAS }, proveedores: [], contoCaja: false, efectivoContado: null, desgloseConteo: null, sucio: false,
}

export function reducer(s: FormState, a: Accion): FormState {
  switch (a.type) {
    // Una carga siempre parte limpia, incluso la que recupera un borrador
    // del dispositivo: eso se sube al primer cambio o al cerrar. Quien
    // necesita marcar cambios pendientes sin pasar por acá (el camino de
    // "sobrescribir" tras un conflicto) lo hace sobre la copia en el ref.
    case 'cargar': return { ...inicial, ...a.state, cargado: true, sucio: false }
    case 'venta': return { ...s, ventas: { ...s.ventas, [a.key]: a.monto }, sucio: true }
    case 'proveedor': {
      const existe = s.proveedores.some((p) => p.key === a.linea.key)
      // Una hoja abierta antes de que la línea recibiera su id la devuelve
      // sin id: se conserva el que ya tiene, o se reinsertaría al guardar.
      return { ...s, sucio: true, proveedores: existe ? s.proveedores.map((p) => (p.key === a.linea.key ? { ...a.linea, id: a.linea.id ?? p.id } : p)) : [...s.proveedores, a.linea] }
    }
    case 'quitarProveedor': return { ...s, sucio: true, proveedores: s.proveedores.filter((p) => p.key !== a.key) }
    case 'trabajador': return { ...s, trabajadorId: a.id, sucio: true }
    case 'fondo': return { ...s, fondoInicial: a.monto, sucio: true }
    case 'caja': return { ...s, contoCaja: a.conto, efectivoContado: a.conto ? a.monto : null, desgloseConteo: a.conto ? (a.desglose ?? null) : null, sucio: true }
    case 'sincronizado': return {
      ...s,
      turnoId: a.turno.id,
      baseUpdatedAt: a.turno.updated_at,
      // Si el usuario siguió escribiendo mientras viajaba la petición, sigue
      // habiendo cambios pendientes (a.sucio = true) y el próximo autoguardado
      // los manda; antes se marcaba limpio y esos cambios quedaban solo en el
      // dispositivo hasta el cierre (Hoy mostraba datos viejos).
      sucio: a.sucio,
    }
    case 'idsLineas': return {
      ...s,
      proveedores: s.proveedores.map((p) => (!p.id && a.ids[p.key] ? { ...p, id: a.ids[p.key] } : p)),
    }
  }
}

let seq = 0
export const nuevaKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`

function ventasDe(v: Partial<Record<MetodoKey, unknown>>): Ventas {
  const r = { ...VENTAS_VACIAS }
  for (const k of METODO_KEYS) r[k] = toNum(v[k])
  return r
}

export function desdeServidor(t: TurnoConLineas): Partial<FormState> {
  const v = t.turno
  return {
    turnoId: v.id,
    cerrado: !v.is_draft,
    baseUpdatedAt: v.updated_at,
    trabajadorId: v.trabajador_id,
    fondoInicial: toNum(v.fondo_inicial),
    ventas: ventasDe(v),
    proveedores: t.proveedores.map((p) => ({
      key: p.id, id: p.id, proveedor_id: p.proveedor_id, nombre: p.nombre, monto: toNum(p.monto),
      forma_pago: p.forma_pago === 'transferencia' ? 'transferencia' : 'efectivo',
    })),
    contoCaja: v.efectivo_contado != null,
    efectivoContado: v.efectivo_contado,
    desgloseConteo: null,
  }
}

export function desdeLocal(b: BorradorLocal, servidor: TurnoConLineas | undefined): Partial<FormState> {
  return {
    turnoId: servidor?.turno.id ?? null,
    cerrado: servidor ? !servidor.turno.is_draft : false,
    baseUpdatedAt: servidor?.turno.updated_at ?? b.baseUpdatedAt,
    trabajadorId: b.trabajadorId,
    fondoInicial: b.fondoInicial,
    ventas: { ...VENTAS_VACIAS, ...b.ventas },
    proveedores: b.proveedores.map((p) => ({ ...p, key: p.id ?? nuevaKey() })),
    contoCaja: b.contoCaja,
    efectivoContado: b.efectivoContado,
    desgloseConteo: b.desgloseConteo ?? null,
  }
}

export function tieneContenido(s: FormState): boolean {
  return Object.values(s.ventas).some((v) => v > 0) || s.proveedores.some((p) => p.monto > 0)
}

/** Dos `updated_at` del servidor son la misma versión (tolera formatos distintos). */
export function mismaVersion(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const ta = Date.parse(a)
  return !Number.isNaN(ta) && ta === Date.parse(b)
}

/**
 * El turno que trae un refetch es el que este mismo formulario acaba de
 * guardar: misma versión, mismo turno y mismo estado de cierre. Entonces no
 * hay nada nuevo que cargar, y recargar haría daño: el servidor no guarda el
 * conteo de un borrador (solo existe en `turno_cierres`) y las líneas
 * nuevas cambiarían de `key`.
 */
export function esEscrituraPropia(servidor: TurnoConLineas | undefined, s: FormState): boolean {
  return !!servidor && s.cargado && s.turnoId === servidor.turno.id
    && s.cerrado === !servidor.turno.is_draft
    && mismaVersion(s.baseUpdatedAt, servidor.turno.updated_at)
}

/**
 * Ids de base para las líneas que el formulario creó sin id, emparejadas con
 * las del servidor que ninguna línea reclama: mismo monto y forma de pago, y
 * mismo proveedor del catálogo o, sin él, el mismo nombre normalizado. Sin
 * pareja, la línea sigue sin id (el próximo guardado la vuelve a insertar).
 */
export function idsLineasNuevas(lineas: LineaForm[], delServidor: TurnoConLineas['proveedores']): Record<string, string> {
  const reclamados = new Set(lineas.map((l) => l.id).filter((id): id is string => !!id))
  const libres = delServidor.filter((p) => !reclamados.has(p.id))
  const ids: Record<string, string> = {}
  for (const l of lineas) {
    if (l.id || !(l.monto > 0)) continue
    const i = libres.findIndex((p) => toNum(p.monto) === l.monto
      && (p.forma_pago === 'transferencia' ? 'transferencia' : 'efectivo') === l.forma_pago
      && (l.proveedor_id ? p.proveedor_id === l.proveedor_id : normalizar(p.nombre) === normalizar(l.nombre)))
    if (i < 0) continue
    ids[l.key] = libres[i]!.id
    libres.splice(i, 1)
  }
  return ids
}

interface Origenes {
  servidor: TurnoConLineas | undefined
  local: BorradorLocal | null
  fondoPorDefecto: number
}

/**
 * Con qué se abre el formulario. El borrador del dispositivo gana solo si
 * el turno del servidor sigue siendo borrador y, además, se editó sobre esa
 * misma versión (nadie guardó después; incluye el conteo, que el servidor
 * no tiene) o es más nuevo que ella:
 * sobre un turno ya cerrado manda siempre el servidor, porque lo local
 * puede ser de antes del cierre. Si gana el servidor y había borrador, hay
 * que borrarlo (`descartarLocal`) para no revivirlo en la próxima carga.
 */
export function cargaInicial({ servidor, local, fondoPorDefecto }: Origenes): { state: Partial<FormState>; descartarLocal: boolean } {
  const servidorMs = servidor ? new Date(servidor.turno.updated_at ?? 0).getTime() : 0
  const usarLocal = !!local && (!servidor || servidor.turno.is_draft)
    && (local.guardadoEn > servidorMs || mismaVersion(local.baseUpdatedAt, servidor?.turno.updated_at))
  if (usarLocal && local) return { state: desdeLocal(local, servidor), descartarLocal: false }
  if (servidor) return { state: desdeServidor(servidor), descartarLocal: !!local }
  return { state: { fondoInicial: fondoPorDefecto }, descartarLocal: false }
}

/**
 * Si el autoguardado con debounce tiene algo que mandar. Con un borrador ya
 * creado en el servidor se sincroniza todo, incluso dejar un monto en 0
 * (antes "sin contenido" = no enviar, y el servidor conservaba el valor
 * anterior). Sin borrador aún, se espera al primer dato.
 */
export function debeAutoguardar(s: FormState, { online, guardando }: { online: boolean; guardando: boolean }): boolean {
  return s.sucio && !s.cerrado && online && !guardando && (tieneContenido(s) || s.turnoId != null)
}

/**
 * Al salir de la pantalla o irse a segundo plano no se espera el debounce:
 * lo pendiente se manda ya, para que Hoy lo muestre al llegar.
 */
export function debeEnviarAlSalir(s: FormState, online: boolean): boolean {
  return s.sucio && !s.cerrado && online && (tieneContenido(s) || s.turnoId != null)
}
