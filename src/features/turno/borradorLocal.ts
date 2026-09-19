import { get, set, del, keys } from 'idb-keyval'
import type { Modo } from './api'
import type { MetodoKey, ProveedorLinea } from '@/lib/totales'
import type { Conteo } from './conteo'

/**
 * Borrador en el dispositivo: cada cambio del formulario se guarda acá al
 * instante (IndexedDB), así una recarga o un corte de red a mitad del
 * cierre no pierde nada. El borrador en el servidor (guardar_turno con
 * cerrar:false) va con debounce; este es la red de seguridad.
 */
export interface BorradorLocal {
  fecha: string
  modo: Modo
  trabajadorId: string | null
  fondoInicial: number
  ventas: Partial<Record<MetodoKey, number>>
  proveedores: ProveedorLinea[]
  efectivoContado: number | null
  contoCaja: boolean
  /** Desglose por denominaciones del conteo de caja (solo en el dispositivo:
   *  al servidor viaja únicamente el total). Los borradores anteriores a
   *  esta versión no lo traen. */
  desgloseConteo?: Conteo | null
  guardadoEn: number
  /** updated_at del turno en el servidor sobre el que se editó (para el conflicto). */
  baseUpdatedAt: string | null
}

const PREFIX = 'borrador:'
const clave = (fecha: string, modo: Modo) => `${PREFIX}${fecha}:${modo}`

export async function leerBorradorLocal(fecha: string, modo: Modo): Promise<BorradorLocal | null> {
  try { return (await get<BorradorLocal>(clave(fecha, modo))) ?? null } catch { return null }
}

export async function guardarBorradorLocal(b: BorradorLocal): Promise<void> {
  try { await set(clave(b.fecha, b.modo), b) } catch { /* sin storage */ }
}

export async function borrarBorradorLocal(fecha: string, modo: Modo): Promise<void> {
  try { await del(clave(fecha, modo)) } catch { /* sin storage */ }
}

export async function listarBorradoresLocales(): Promise<BorradorLocal[]> {
  try {
    const ks = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX))
    const vals = await Promise.all(ks.map((k) => get<BorradorLocal>(k)))
    return vals.filter((v): v is BorradorLocal => !!v)
  } catch { return [] }
}
