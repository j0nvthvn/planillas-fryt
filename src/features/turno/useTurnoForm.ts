import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cargarTurnosDia, guardarTurno, ErrorGuardado, type Modo, type VTurno } from './api'
import { leerBorradorLocal, borrarBorradorLocal } from './borradorLocal'
import { usePersistenciaLocal } from './usePersistenciaLocal'
import { marcarInicio, registrarCierre } from './metricas'
import {
  cargaInicial, debeAutoguardar, debeEnviarAlSalir, esEscrituraPropia, idsLineasNuevas, inicial, reducer, tieneContenido,
  type Accion, type EstadoSync,
} from './estadoTurno'
import { crearColaGuardado } from './colaGuardado'
import { qk } from '@/lib/query'
import { totalesTurno } from '@/lib/totales'
import { logError } from '@/lib/errorLog'

/** `alCerrar`: el conflicto apareció al cerrar, así que reemplazar también cierra. */
export interface Conflicto { actual: VTurno; alCerrar: boolean }

export type ResultadoGuardado = { estado: 'ok' } | { estado: 'conflicto' } | { estado: 'error'; mensaje: string }

interface Opciones {
  fecha: string
  modo: Modo
  /** `null` mientras no llega la configuración: el formulario espera para cargar. */
  fondoPorDefecto: number | null
  online: boolean
}

/**
 * Conecta el estado del formulario (`estadoTurno.ts`, sin React) con la red:
 *  - carga el turno del servidor y el borrador local y usa el que corresponda;
 *  - cada cambio se guarda al instante en el dispositivo;
 *  - con contenido y conexión, borrador en el servidor con debounce;
 *  - `cerrar()` hace todo en una llamada (guardar_turno con cerrar:true);
 *  - una sola solicitud a la vez (`colaGuardado.ts`); con un conflicto
 *    pendiente no se manda nada hasta que se elija qué hacer;
 *  - al cambiar de fecha o de modo, lo pendiente se manda antes de cargar
 *    el formulario nuevo.
 */
export function useTurnoForm({ fecha, modo, fondoPorDefecto, online }: Opciones) {
  const [state, dispatch] = useReducer(reducer, inicial)
  const [conflicto, setConflictoEstado] = useState<Conflicto | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAutosave, setErrorAutosave] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const { persistir: persistirLocal, localOk } = usePersistenciaLocal(fecha, modo)
  const [cola] = useState(crearColaGuardado)
  /**
   * El formulario cargado: su (fecha, modo) y el `sincronizar` atado a ellos.
   * Durante un cambio de fecha o de modo el estado sigue siendo el anterior
   * hasta que carga el nuevo, así que lo pendiente sale con este.
   */
  const formActual = useRef<{ clave: string; sincronizar: (cerrar: boolean) => Promise<ResultadoGuardado> } | null>(null)
  const [claveCargada, setClaveCargada] = useState('')
  const clave = `${fecha}|${modo}`
  const stateRef = useRef(state)
  stateRef.current = state
  const conflictoRef = useRef<Conflicto | null>(null)
  const setConflicto = useCallback((c: Conflicto | null) => { conflictoRef.current = c; setConflictoEstado(c) }, [])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Contador de cambios: detecta escrituras ocurridas durante una sincronización. */
  const cambios = useRef(0)
  const tipo = modo === 'tarde' ? 'tarde' : 'mañana'

  const dia = useQuery({
    queryKey: qk.turnosDia(fecha),
    queryFn: () => cargarTurnosDia(fecha),
    // Una copia reciente de IndexedDB puede ser de antes del último guardado:
    // con conexión, el formulario espera la respuesta del servidor.
    refetchOnMount: 'always',
  })

  // ---- carga inicial (servidor + local) ----
  const cargadoPara = useRef<string>('')
  useEffect(() => {
    if (dia.isPending || (online && !dia.isFetchedAfterMount)) return
    // Un turno nuevo parte con el fondo de la configuración: cargarlo antes
    // dejaba el valor por defecto ($0), y la configuración que llegaba
    // después ya no lo cambiaba.
    if (fondoPorDefecto == null) return
    // Sin el turno del servidor, el primer dato saldría sin versión base y la
    // RPC sobrescribiría el borrador existente: la pantalla muestra el error.
    if (dia.isError && !stateRef.current.cargado) return
    const firma = `${fecha}|${modo}|${dia.dataUpdatedAt}`
    if (cargadoPara.current === firma) return
    const mismoFormulario = cargadoPara.current.startsWith(`${fecha}|${modo}|`)
    const servidor = (dia.data ?? []).find((t) => t.turno.tipo === tipo)
    // El refetch que sigue a un guardado propio trae lo mismo que se guardó,
    // menos el conteo de caja y los ids de las líneas nuevas: se toman solo
    // los ids, sin recargar.
    if (mismoFormulario && servidor && esEscrituraPropia(servidor, stateRef.current)) {
      cargadoPara.current = firma
      const ids = idsLineasNuevas(stateRef.current.proveedores, servidor.proveedores)
      if (Object.keys(ids).length) {
        const a: Accion = { type: 'idsLineas', ids }
        dispatch(a)
        stateRef.current = reducer(stateRef.current, a)
        persistirLocal(stateRef.current)
      }
      return
    }
    // Si ya hay cambios sin sincronizar para este mismo (fecha, modo), un
    // refetch no debe pisarlos.
    if (mismoFormulario && stateRef.current.sucio) { cargadoPara.current = firma; return }
    cargadoPara.current = firma
    let vivo = true
    let listo = false
    const anterior = formActual.current?.clave !== clave ? formActual.current : null
    if (anterior && timer.current) clearTimeout(timer.current)
    void (async () => {
      // Lo pendiente del formulario anterior sale antes de reemplazarlo. Si no
      // se puede (sin red, conflicto), queda en el dispositivo como pendiente
      // y se recupera al volver a esa fecha.
      if (anterior && debeEnviarAlSalir(stateRef.current, navigator.onLine)) {
        await anterior.sincronizar(false)
        if (!vivo) return
      }
      const local = await leerBorradorLocal(fecha, modo)
      if (!vivo) return
      listo = true
      const { state: inicio, descartarLocal, conflicto: enConflicto } = cargaInicial({ servidor, local, fondoPorDefecto })
      const a: Accion = { type: 'cargar', state: inicio }
      dispatch(a)
      stateRef.current = reducer(stateRef.current, a)
      formActual.current = { clave, sincronizar: sincronizarRef.current }
      setClaveCargada(clave)
      setErrorAutosave(null)
      setConflicto(enConflicto ? { actual: enConflicto, alCerrar: !enConflicto.is_draft } : null)
      if (descartarLocal) void borrarBorradorLocal(fecha, modo)
      // Recuperado con cambios sin subir: se suben sin esperar otra edición.
      if (stateRef.current.sucio) programarAutosaveRef.current()
    })()
    return () => {
      vivo = false
      // Cancelada a medio camino (cambió otra dependencia, como el fondo por
      // defecto al llegar la configuración): la próxima corrida debe cargar,
      // o la pantalla se queda en el spinner.
      if (!listo && cargadoPara.current === firma) cargadoPara.current = ''
    }
  }, [dia.isPending, dia.isFetchedAfterMount, dia.isError, dia.data, dia.dataUpdatedAt, online, fecha, modo, clave, tipo, fondoPorDefecto, persistirLocal, setConflicto])

  // ---- autoguardado ----
  /** Una solicitud. Corre dentro de la cola, así que lee el estado al empezar. */
  const enviar = useCallback(async (cerrar: boolean): Promise<ResultadoGuardado> => {
    const pendiente = conflictoRef.current
    if (pendiente) {
      // Cerrar con un conflicto abierto: al reemplazar, que también cierre.
      if (cerrar && !pendiente.alCerrar) setConflicto({ ...pendiente, alCerrar: true })
      return { estado: 'conflicto' }
    }
    // El estado cargado es de otro formulario (cambio de fecha o de modo a
    // medio camino): no se mezcla con este.
    if (formActual.current && formActual.current.clave !== `${fecha}|${modo}`) {
      return cerrar ? { estado: 'error', mensaje: 'No se pudo guardar. Vuelve a intentarlo.' } : { estado: 'ok' }
    }
    const s = stateRef.current
    // Un autoguardado que esperó su turno puede no tener nada nuevo.
    if (!cerrar && !s.sucio) return { estado: 'ok' }
    const version = cambios.current
    setEnviando(true)
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
      if (r.conflicto) {
        setConflicto({ actual: r.actual, alCerrar: cerrar })
        void logError('conflicto al guardar el turno', { contexto: 'guardar', detalle: { fecha, modo, cerrar } })
        return { estado: 'conflicto' }
      }
      const pendientes = cambios.current !== version
      dispatch({ type: 'sincronizado', turno: r.turno, sucio: pendientes })
      stateRef.current = { ...stateRef.current, turnoId: r.turno.id, baseUpdatedAt: r.turno.updated_at, sucio: pendientes }
      if (pendientes && !cerrar) programarAutosaveRef.current()
      setErrorAutosave(null)
      // El borrador del dispositivo pasa a la versión nueva: al reabrir, gana
      // sobre el servidor y conserva el conteo, que el servidor no tiene.
      if (cerrar) void borrarBorradorLocal(fecha, modo)
      else persistirLocal(stateRef.current)
      return { estado: 'ok' }
    } catch (e) {
      const mensaje = e instanceof ErrorGuardado ? e.message : 'No se pudo guardar. Tus datos quedaron guardados en este dispositivo.'
      setErrorAutosave(mensaje)
      void logError(e instanceof ErrorGuardado ? e.original : e instanceof Error ? e.message : String(e), {
        contexto: 'guardar',
        detalle: { fecha, modo, cerrar, code: e instanceof ErrorGuardado ? e.code : null },
      })
      return { estado: 'error', mensaje }
    } finally {
      setEnviando(false)
    }
  }, [fecha, modo, persistirLocal, setConflicto])

  const sincronizar = useCallback(
    (cerrar: boolean) => cola.encolar(() => enviar(cerrar), { fusionable: !cerrar }),
    [cola, enviar],
  )

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

  // Con el `sincronizar` del formulario cargado, no el del último render:
  // durante un cambio de fecha el estado todavía es el anterior.
  const flush = useCallback(() => {
    if (formActual.current && debeEnviarAlSalir(stateRef.current, navigator.onLine)) {
      if (timer.current) clearTimeout(timer.current)
      void formActual.current.sincronizar(false)
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
      if (r.estado === 'ok') void registrarCierre(`${fecha}:${modo}`, fecha, modo)
      return r
    } finally { setGuardando(false) }
  }, [sincronizar, fecha, modo])

  /** Ante un conflicto: tomar lo del servidor (descarta lo local). */
  const adoptarServidor = useCallback(async () => {
    setConflicto(null)
    await borrarBorradorLocal(fecha, modo)
    cargadoPara.current = ''
    await dia.refetch()
  }, [dia, fecha, modo, setConflicto])

  /** Ante un conflicto: insistir con lo local (sin versión base). */
  const sobrescribir = useCallback(async (cerrarTambien: boolean) => {
    setConflicto(null)
    dispatch({ type: 'cargar', state: { ...stateRef.current, baseUpdatedAt: null, sucio: true } })
    stateRef.current = { ...stateRef.current, baseUpdatedAt: null, sucio: true }
    setGuardando(true)
    try {
      const r = await sincronizar(cerrarTambien)
      if (cerrarTambien && r.estado === 'ok') void registrarCierre(`${fecha}:${modo}`, fecha, modo)
      return r
    } finally { setGuardando(false) }
  }, [sincronizar, setConflicto, fecha, modo])

  const totales = useMemo(() => totalesTurno(state.ventas, state.proveedores, state.fondoInicial), [state.ventas, state.proveedores, state.fondoInicial])
  const diferenciaCaja = state.contoCaja && state.efectivoContado != null ? state.efectivoContado - totales.efectivo_esperado : null

  const sync: EstadoSync = conflicto ? 'conflicto'
    : enviando ? 'enviando'
    : errorAutosave && state.sucio ? 'error'
    : state.sucio ? 'pendiente'
    : state.turnoId ? 'sincronizado'
    : 'nuevo'

  return {
    state, cambiar, cerrar, totales, diferenciaCaja, guardando, conflicto, adoptarServidor, sobrescribir, errorAutosave,
    sync, localOk,
    /** El formulario cargado es el de esta fecha y modo (no el anterior). */
    listo: state.cargado && claveCargada === clave,
    dia: dia.data ?? [], cargandoDia: dia.isPending,
    /** La consulta del día falló antes de cargar el formulario: no se puede editar. */
    errorDia: dia.isError && !state.cargado,
    reintentarDia: () => void dia.refetch(),
  }
}
