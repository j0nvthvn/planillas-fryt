import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cargarTurnosDia, guardarTurno, ErrorGuardado, type Modo, type TurnoConLineas, type VTurno } from './api'
import { leerBorradorLocal, guardarBorradorLocal, borrarBorradorLocal, type BorradorLocal } from './borradorLocal'
import { qk } from '@/lib/query'
import { totalesTurno, VENTAS_VACIAS, type MetodoKey, type ProveedorLinea, type Ventas } from '@/lib/totales'
import { toNum } from '@/lib/format'

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
  /** Hubo cambios desde la última sincronización con el servidor. */
  sucio: boolean
}

type Accion =
  | { type: 'cargar'; state: Partial<FormState> }
  | { type: 'venta'; key: MetodoKey; monto: number }
  | { type: 'proveedor'; linea: LineaForm }
  | { type: 'quitarProveedor'; key: string }
  | { type: 'trabajador'; id: string | null }
  | { type: 'fondo'; monto: number }
  | { type: 'caja'; conto: boolean; monto: number | null }
  | { type: 'sincronizado'; turno: VTurno }

const inicial: FormState = {
  cargado: false, turnoId: null, cerrado: false, baseUpdatedAt: null, trabajadorId: null, fondoInicial: 0,
  ventas: { ...VENTAS_VACIAS }, proveedores: [], contoCaja: false, efectivoContado: null, sucio: false,
}

function reducer(s: FormState, a: Accion): FormState {
  switch (a.type) {
    case 'cargar': return { ...inicial, ...a.state, cargado: true, sucio: false }
    case 'venta': return { ...s, ventas: { ...s.ventas, [a.key]: a.monto }, sucio: true }
    case 'proveedor': {
      const existe = s.proveedores.some((p) => p.key === a.linea.key)
      return { ...s, sucio: true, proveedores: existe ? s.proveedores.map((p) => (p.key === a.linea.key ? a.linea : p)) : [...s.proveedores, a.linea] }
    }
    case 'quitarProveedor': return { ...s, sucio: true, proveedores: s.proveedores.filter((p) => p.key !== a.key) }
    case 'trabajador': return { ...s, trabajadorId: a.id, sucio: true }
    case 'fondo': return { ...s, fondoInicial: a.monto, sucio: true }
    case 'caja': return { ...s, contoCaja: a.conto, efectivoContado: a.conto ? a.monto : null, sucio: true }
    case 'sincronizado': return {
      ...s,
      turnoId: a.turno.id,
      baseUpdatedAt: a.turno.updated_at,
      // Las filas nuevas ya tienen id en la base: se toman del servidor solo si
      // el usuario no siguió escribiendo (sucio) para no pisar sus cambios.
      sucio: false,
    }
  }
}

let seq = 0
export const nuevaKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`

function desdeServidor(t: TurnoConLineas): Partial<FormState> {
  const v = t.turno
  return {
    turnoId: v.id,
    cerrado: !v.is_draft,
    baseUpdatedAt: v.updated_at,
    trabajadorId: v.trabajador_id,
    fondoInicial: toNum(v.fondo_inicial),
    ventas: {
      efectivo: toNum(v.efectivo), getnet: toNum(v.getnet), mercadopago: toNum(v.mercadopago),
      edenred: toNum(v.edenred), amipass: toNum(v.amipass), transferencia: toNum(v.transferencia),
    },
    proveedores: t.proveedores.map((p) => ({
      key: p.id, id: p.id, proveedor_id: p.proveedor_id, nombre: p.nombre, monto: toNum(p.monto),
      forma_pago: p.forma_pago === 'transferencia' ? 'transferencia' : 'efectivo',
    })),
    contoCaja: v.efectivo_contado != null,
    efectivoContado: v.efectivo_contado,
  }
}

function desdeLocal(b: BorradorLocal, servidor: TurnoConLineas | undefined): Partial<FormState> {
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
    sucio: true,
  }
}

export function tieneContenido(s: FormState): boolean {
  return Object.values(s.ventas).some((v) => v > 0) || s.proveedores.some((p) => p.monto > 0)
}

export interface Conflicto { actual: VTurno }

interface Opciones {
  fecha: string
  modo: Modo
  fondoPorDefecto: number
  online: boolean
}

/**
 * Estado del formulario de cierre para (fecha, modo):
 *  - carga el turno del servidor y el borrador local y usa el más reciente;
 *  - cada cambio se guarda al instante en el dispositivo;
 *  - con contenido y conexión, borrador en el servidor con debounce de 3 s;
 *  - `cerrar()` hace todo en una llamada (guardar_turno con cerrar:true).
 */
export function useTurnoForm({ fecha, modo, fondoPorDefecto, online }: Opciones) {
  const [state, dispatch] = useReducer(reducer, inicial)
  const [conflicto, setConflicto] = useState<Conflicto | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAutosave, setErrorAutosave] = useState<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipo = modo === 'tarde' ? 'tarde' : 'mañana'

  const dia = useQuery({ queryKey: qk.turnosDia(fecha), queryFn: () => cargarTurnosDia(fecha) })

  // ---- carga inicial (servidor + local) ----
  const cargadoPara = useRef<string>('')
  useEffect(() => {
    if (dia.isPending) return
    const firma = `${fecha}|${modo}|${dia.dataUpdatedAt}`
    if (cargadoPara.current === firma) return
    // Si ya hay cambios sin sincronizar para este mismo (fecha, modo), un
    // refetch no debe pisarlos.
    if (cargadoPara.current.startsWith(`${fecha}|${modo}|`) && stateRef.current.sucio) { cargadoPara.current = firma; return }
    cargadoPara.current = firma
    let vivo = true
    ;(async () => {
      const servidor = (dia.data ?? []).find((t) => t.turno.tipo === tipo)
      const local = await leerBorradorLocal(fecha, modo)
      if (!vivo) return
      const servidorMs = servidor ? new Date(servidor.turno.updated_at ?? 0).getTime() : 0
      const usarLocal = !!local && (!servidor || servidor.turno.is_draft) && local.guardadoEn > servidorMs
      if (usarLocal && local) dispatch({ type: 'cargar', state: desdeLocal(local, servidor) })
      else if (servidor) { dispatch({ type: 'cargar', state: desdeServidor(servidor) }); void borrarBorradorLocal(fecha, modo) }
      else dispatch({ type: 'cargar', state: { fondoInicial: fondoPorDefecto } })
    })()
    return () => { vivo = false }
  }, [dia.isPending, dia.data, dia.dataUpdatedAt, fecha, modo, tipo, fondoPorDefecto])

  // ---- persistencia local + autoguardado ----
  const persistirLocal = useCallback((s: FormState) => {
    void guardarBorradorLocal({
      fecha, modo, trabajadorId: s.trabajadorId, fondoInicial: s.fondoInicial, ventas: s.ventas,
      proveedores: s.proveedores.map(({ key: _k, ...p }) => p), efectivoContado: s.efectivoContado, contoCaja: s.contoCaja,
      guardadoEn: Date.now(), baseUpdatedAt: s.baseUpdatedAt,
    })
  }, [fecha, modo])

  const sincronizar = useCallback(async (cerrar: boolean): Promise<'ok' | 'conflicto' | 'error'> => {
    const s = stateRef.current
    try {
      const r = await guardarTurno({
        fecha, modo,
        trabajador_id: s.trabajadorId,
        fondo_inicial: s.fondoInicial,
        ventas: s.ventas,
        proveedores: s.proveedores.map(({ key: _k, ...p }) => p),
        cerrar,
        efectivo_contado: cerrar ? (s.contoCaja ? s.efectivoContado : null) : undefined,
        base_updated_at: s.baseUpdatedAt,
      })
      if (r.conflicto) { setConflicto({ actual: r.actual }); return 'conflicto' }
      dispatch({ type: 'sincronizado', turno: r.turno })
      setErrorAutosave(null)
      if (cerrar) void borrarBorradorLocal(fecha, modo)
      return 'ok'
    } catch (e) {
      setErrorAutosave(e instanceof ErrorGuardado ? e.message : 'No se pudo guardar')
      return 'error'
    }
  }, [fecha, modo])

  const programarAutosave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const s = stateRef.current
      if (!s.sucio || s.cerrado || !online || !tieneContenido(s) || guardando) return
      void sincronizar(false)
    }, 3000)
  }, [online, sincronizar, guardando])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // Al volver la conexión, reintenta lo pendiente.
  useEffect(() => { if (online && stateRef.current.sucio) programarAutosave() }, [online, programarAutosave])

  const cambiar = useCallback((a: Accion) => {
    dispatch(a)
    // El reducer es puro: se calcula el siguiente estado para persistirlo ya.
    const siguiente = reducer(stateRef.current, a)
    stateRef.current = siguiente
    persistirLocal(siguiente)
    programarAutosave()
  }, [persistirLocal, programarAutosave])

  const cerrar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    setGuardando(true)
    try { return await sincronizar(true) } finally { setGuardando(false) }
  }, [sincronizar])

  /** Ante un conflicto: tomar lo del servidor (descarta lo local). */
  const adoptarServidor = useCallback(async () => {
    setConflicto(null)
    await borrarBorradorLocal(fecha, modo)
    cargadoPara.current = ''
    await dia.refetch()
  }, [dia, fecha, modo])

  /** Ante un conflicto: insistir con lo local (sin versión base). */
  const sobrescribir = useCallback(async (cerrarTambien: boolean) => {
    setConflicto(null)
    dispatch({ type: 'cargar', state: { ...stateRef.current, baseUpdatedAt: null, sucio: true } })
    stateRef.current = { ...stateRef.current, baseUpdatedAt: null, sucio: true }
    setGuardando(true)
    try { return await sincronizar(cerrarTambien) } finally { setGuardando(false) }
  }, [sincronizar])

  const totales = useMemo(() => totalesTurno(state.ventas, state.proveedores, state.fondoInicial), [state.ventas, state.proveedores, state.fondoInicial])
  const diferenciaCaja = state.contoCaja && state.efectivoContado != null ? state.efectivoContado - totales.efectivo_esperado : null

  return {
    state, cambiar, cerrar, totales, diferenciaCaja, guardando, conflicto, adoptarServidor, sobrescribir, errorAutosave,
    dia: dia.data ?? [], cargandoDia: dia.isPending,
  }
}
