import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cargarTurnosDia, guardarTurno, ErrorGuardado, type Modo, type VTurno } from './api'
import { leerBorradorLocal, guardarBorradorLocal, borrarBorradorLocal } from './borradorLocal'
import { marcarInicio, registrarCierre } from './metricas'
import {
  cargaInicial, debeAutoguardar, debeEnviarAlSalir, inicial, reducer, tieneContenido,
  type Accion, type FormState,
} from './estadoTurno'
import { qk } from '@/lib/query'
import { totalesTurno } from '@/lib/totales'

export interface Conflicto { actual: VTurno }

interface Opciones {
  fecha: string
  modo: Modo
  fondoPorDefecto: number
  online: boolean
}

/**
 * Conecta el estado del formulario (`estadoTurno.ts`, sin React) con la red:
 *  - carga el turno del servidor y el borrador local y usa el que corresponda;
 *  - cada cambio se guarda al instante en el dispositivo;
 *  - con contenido y conexión, borrador en el servidor con debounce;
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
  /** Contador de cambios: detecta escrituras ocurridas durante una sincronización. */
  const cambios = useRef(0)
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
    let listo = false
    void (async () => {
      const servidor = (dia.data ?? []).find((t) => t.turno.tipo === tipo)
      const local = await leerBorradorLocal(fecha, modo)
      if (!vivo) return
      listo = true
      const { state: inicio, descartarLocal } = cargaInicial({ servidor, local, fondoPorDefecto })
      dispatch({ type: 'cargar', state: inicio })
      if (descartarLocal) void borrarBorradorLocal(fecha, modo)
    })()
    return () => {
      vivo = false
      // Cancelada a medio camino (cambió otra dependencia, como el fondo por
      // defecto al llegar la configuración): la próxima corrida debe cargar,
      // o la pantalla se queda en el spinner.
      if (!listo && cargadoPara.current === firma) cargadoPara.current = ''
    }
  }, [dia.isPending, dia.data, dia.dataUpdatedAt, fecha, modo, tipo, fondoPorDefecto])

  // ---- persistencia local + autoguardado ----
  const persistirLocal = useCallback((s: FormState) => {
    void guardarBorradorLocal({
      fecha, modo, trabajadorId: s.trabajadorId, fondoInicial: s.fondoInicial, ventas: s.ventas,
      proveedores: s.proveedores.map(({ key: _k, ...p }) => p), efectivoContado: s.efectivoContado, contoCaja: s.contoCaja,
      desgloseConteo: s.desgloseConteo,
      guardadoEn: Date.now(), baseUpdatedAt: s.baseUpdatedAt,
    })
  }, [fecha, modo])

  const sincronizar = useCallback(async (cerrar: boolean): Promise<'ok' | 'conflicto' | 'error'> => {
    const s = stateRef.current
    const version = cambios.current
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
      const pendientes = cambios.current !== version
      dispatch({ type: 'sincronizado', turno: r.turno, sucio: pendientes })
      stateRef.current = { ...stateRef.current, turnoId: r.turno.id, baseUpdatedAt: r.turno.updated_at, sucio: pendientes }
      if (pendientes && !cerrar) programarAutosaveRef.current()
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
      if (!debeAutoguardar(stateRef.current, { online, guardando })) return
      void sincronizar(false)
    }, 1500)
  }, [online, sincronizar, guardando])
  const programarAutosaveRef = useRef(programarAutosave)
  programarAutosaveRef.current = programarAutosave
  const sincronizarRef = useRef(sincronizar)
  sincronizarRef.current = sincronizar

  const flush = useCallback(() => {
    if (debeEnviarAlSalir(stateRef.current, navigator.onLine)) {
      if (timer.current) clearTimeout(timer.current)
      void sincronizarRef.current(false)
    }
  }, [])
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flush])

  // Al volver la conexión, reintenta lo pendiente.
  useEffect(() => { if (online && stateRef.current.sucio) programarAutosave() }, [online, programarAutosave])

  const cambiar = useCallback((a: Accion) => {
    dispatch(a)
    // El reducer es puro: se calcula el siguiente estado para persistirlo ya.
    const siguiente = reducer(stateRef.current, a)
    stateRef.current = siguiente
    cambios.current += 1
    if (tieneContenido(siguiente)) marcarInicio(`${fecha}:${modo}`)
    persistirLocal(siguiente)
    programarAutosave()
  }, [persistirLocal, programarAutosave, fecha, modo])

  const cerrar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    setGuardando(true)
    try {
      const r = await sincronizar(true)
      if (r === 'ok') void registrarCierre(`${fecha}:${modo}`, fecha, modo)
      return r
    } finally { setGuardando(false) }
  }, [sincronizar, fecha, modo])

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
    dispatch({ type: 'cargar', state: { ...stateRef.current, baseUpdatedAt: null } })
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
