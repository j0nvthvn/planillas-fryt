import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useJornadaRealtime } from '../hooks/useJornadaRealtime'
import { useErrorToast } from '../hooks/useErrorToast'
import { useConflictoRemoto } from '../hooks/useConflictoRemoto'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import { hoy, fechaLegible, clp } from '../utils/format'
import Icon from '../components/Icon'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  ACCENT, ACCENT_TINT, METODOS_VENTA, VENTAS_VACIAS,
} from '../components/TurnoInput'
import { useTurnoForm } from '../components/turno/useTurnoForm'
import { useIsDesktop } from '../components/turno/useIsDesktop'
import { ProveedoresSection, VentasSection } from '../components/turno/TurnoSections'
import { TurnoSheets } from '../components/turno/TurnoSheets'
import { TurnoBottomBar } from '../components/turno/TurnoBottomBar'
import { ConteoCajaSheet } from '../components/turno/ConteoCajaSheet'
import { FondoCajaSheet } from '../components/turno/FondoCajaSheet'
import { eliminarTurno, guardarTurno, finalizarTurno as finalizarTurnoApi, actualizarFondoInicial } from '../components/turno/turnoApi'

function SegmentedTipo({ tipo, tiposExistentes, turnosDraft, esDiaUnico, onChange }) {
  if (esDiaUnico) {
    const completado = tiposExistentes.includes('mañana') && !turnosDraft['mañana']
    const enProgreso = tiposExistentes.includes('mañana') && turnosDraft['mañana']
    return (
      <div className="flex p-1 bg-brand-tint rounded-[15px]">
        <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[11px] text-[14px] font-semibold bg-card text-ink shadow-sm">
          <Icon name="sun" className="w-4 h-4" stroke={1.8} />
          Mañana
          {completado && (
            <Icon name="check" className="w-3.5 h-3.5 text-pos" stroke={2.5} />
          )}
          {enProgreso && (
            <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
          )}
          <span className="text-[11px] text-muted font-normal">(turno único)</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-1 p-1 bg-brand-tint rounded-[15px]">
      {[['mañana', 'sun'], ['tarde', 'moon']].map(([t, ic]) => {
        const esActivo = tipo === t
        const completado = tiposExistentes.includes(t) && !turnosDraft[t]
        const enProgreso = tiposExistentes.includes(t) && turnosDraft[t]
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[11px] text-[14px] font-semibold capitalize transition ${
              esActivo
                ? 'bg-card text-ink shadow-sm'
                : 'text-muted hover:text-ink2'
            }`}
          >
            <Icon name={ic} className="w-4 h-4" stroke={esActivo ? 1.8 : 1.6} />
            {t}
            {completado && (
              <Icon name="check" className="w-3.5 h-3.5 text-pos" stroke={2.5} />
            )}
            {enProgreso && (
              <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function Turno() {
  const { usuario } = useAuth()
  const { esDiaUnico, config } = useConfig()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const online = useOnlineStatus()

  const [tipo, setTipo] = useState(null)
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [tiposExistentes, setTiposExistentes] = useState([])
  const [turnosDraft, setTurnosDraft] = useState({})  // { mañana: true, tarde: false }
  const [sugerencias, setSugerencias] = useState([])
  const [error, setError] = useState('')
  const [showLimpiarConfirm, setShowLimpiarConfirm] = useState(false)
  const [showConteoSheet, setShowConteoSheet] = useState(false)
  const [showFondoSheet, setShowFondoSheet] = useState(false)
  const [fondoInicial, setFondoInicial] = useState(0)
  const [turnoIdExistente, setTurnoIdExistente] = useState(null)
  const [turnoVersion, setTurnoVersion] = useState(null)
  const [jornadaId, setJornadaId] = useState(null)
  const [cambiosLocales, setCambiosLocales] = useState(false)
  const [autoguardando, setAutoguardando] = useState(false)
  const [cambioRemotoPendiente, setCambioRemotoPendiente] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [detectKey, setDetectKey] = useState(0)
  const turnoIdRef = useRef(null)
  const fondoInicialRef = useRef(0)
  const savingRef = useRef(false)
  const savingCountRef = useRef(0)
  const saveQueueRef = useRef(Promise.resolve())
  const tipoInicializadoRef = useRef(false)
  const tipoAnteriorRef = useRef(null)

  // Cola de saves: encadena promesas para que corran en serie
  // y la última escritura gana, evitando race conditions.
  function enqueueSave(task) {
    saveQueueRef.current = saveQueueRef.current
      .then(task, task)
      .catch((err) => { console.error(err); setError('No se pudo guardar el cambio. Reintenta.') })
    return saveQueueRef.current
  }

  function startSaving() {
    savingCountRef.current += 1
    savingRef.current = true
    setAutoguardando(true)
  }
  function endSaving() {
    savingCountRef.current = Math.max(0, savingCountRef.current - 1)
    if (savingCountRef.current === 0) {
      setAutoguardando(false)
      // Mantener savingRef activo un poco más que el debounce de realtime (180ms)
      // para absorber el eco de nuestra propia escritura — la latencia real de
      // Realtime puede superar holgadamente los 180ms, así que damos margen extra.
      setTimeout(() => {
        if (savingCountRef.current === 0) savingRef.current = false
      }, 900)
    }
  }

  // Guarda el turno (crea si hace falta). Si se pasan proveedores,
  // sincroniza el estado local con los ids reales que asignó la base
  // de datos; si se pasan ventas, las autoguarda — cada autoguardado
  // toca solo la tabla que corresponde (nunca reescribe proveedores
  // por un cambio de ventas, ni viceversa).
  async function guardarYSincronizar({ proveedores, ventas: ventasAGuardar } = {}) {
    if (!usuario?.id) throw new Error('Sin usuario')
    const { turnoId: id, proveedores: sincronizados } = await guardarTurno({
      fecha: hoy(), tipo, usuarioId: usuario.id, proveedores, ventas: ventasAGuardar, fondoInicial: fondoInicialRef.current,
    })
    turnoIdRef.current = id
    setTurnoIdExistente(id)
    setTiposExistentes((prev) => [...new Set([...prev, tipo])])
    setTurnosDraft((prev) => ({ ...prev, [tipo]: true }))
    if (sincronizados) setProvs(sincronizados)
    return id
  }

  const handleProvCommit = useCallback((_row, _idx, newProvs) => {
    if (!usuario) return
    startSaving()
    enqueueSave(async () => {
      try {
        await guardarYSincronizar({ proveedores: newProvs })
        setCambiosLocales(false)
      } finally {
        endSaving()
      }
    })
  }, [usuario, tipo])

  const handleProvDelete = useCallback((_row, _idx, newProvs) => {
    if (!usuario) return
    startSaving()
    enqueueSave(async () => {
      try {
        await guardarYSincronizar({ proveedores: newProvs })
        setCambiosLocales(false)
      } finally {
        endSaving()
      }
    })
  }, [usuario, tipo])

  const handleVentaCommit = useCallback((newVentas) => {
    if (!usuario) return
    startSaving()
    enqueueSave(async () => {
      try {
        await guardarYSincronizar({ ventas: newVentas })
        setCambiosLocales(false)
      } finally {
        endSaving()
      }
    })
  }, [usuario, tipo])

  const form = useTurnoForm({
    onDirty: () => setCambiosLocales(true),
    onProvCommit: handleProvCommit,
    onProvDelete: handleProvDelete,
    onVentaCommit: handleVentaCommit,
  })
  const { provs, setProvs, ventas, setVentas } = form

  // Cargar datos del turno ya guardado, o limpiar el formulario si aún no existe.
  // Depende solo de [tipo, loadKey] — nunca de tiposExistentes/turnosDraft, que
  // cambian por nuestras propias escrituras optimistas (autoguardado de
  // proveedores) y solo alimentan indicadores visuales. Si dependiera de eso,
  // cada autoguardado dispararía un refetch completo y un parpadeo del formulario.
  //
  // loadKey también se incrementa cuando llega un cambio remoto (incluido el
  // eco de nuestro propio guardado si llega fuera de la ventana de gracia de
  // savingRef). Para que eso nunca se sienta como "se recargó toda la
  // pantalla", solo limpiamos a blanco + mostramos el spinner cuando el tipo
  // de turno realmente cambió; un refresco del mismo tipo actualiza los
  // datos en su lugar una vez que llegan, sin pasar por un estado vacío.
  useEffect(() => {
    if (!tipo) return
    let activo = true
    const esCambioDeTipo = tipoAnteriorRef.current !== tipo
    tipoAnteriorRef.current = tipo
    if (esCambioDeTipo) {
      turnoIdRef.current = null
      setTurnoIdExistente(null)
      setTurnoVersion(null)
      setProvs([])
      setVentas(VENTAS_VACIAS)
      setCambioRemotoPendiente(false)
      setCambiosLocales(false)
      setFondoInicial(config.fondoCajaInicial ?? 0)
      setCargandoDatos(true)
    }
    async function cargar() {
      try {
      const [{ data: jornada }, { data: frecuentes }] = await Promise.all([
        supabase.from('jornadas').select('id').eq('fecha', hoy()).maybeSingle(),
        supabase.from('proveedores_frecuentes').select('nombre, imagen_url'),
      ])
      if (!activo) return
      setJornadaId(jornada?.id || null)
      if (!jornada) {
        if (esCambioDeTipo) return
        turnoIdRef.current = null
        setTurnoIdExistente(null)
        setTurnoVersion(null)
        setProvs([])
        setVentas(VENTAS_VACIAS)
        return
      }
      const imgMap = Object.fromEntries((frecuentes || []).map((f) => [f.nombre, f.imagen_url || '']))
      const { data: turno } = await supabase
        .from('turnos')
        .select('id, updated_at, fondo_inicial, proveedores:proveedores_turno(nombre, monto, forma_pago), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)')
        .eq('jornada_id', jornada.id)
        .eq('tipo', tipo)
        .is('deleted_at', null)
        .maybeSingle()
      if (!activo) return
      if (!turno) {
        if (esCambioDeTipo) return
        turnoIdRef.current = null
        setTurnoIdExistente(null)
        setTurnoVersion(null)
        setProvs([])
        setVentas(VENTAS_VACIAS)
        return
      }
      setTurnoIdExistente(turno.id)
      turnoIdRef.current = turno.id
      setTurnoVersion(turno.updated_at)
      setFondoInicial(+turno.fondo_inicial || 0)
      setProvs(turno.proveedores?.length
        ? turno.proveedores.map((p) => ({ id: p.id, nombre: p.nombre, monto: +p.monto, forma_pago: p.forma_pago, imagen_url: imgMap[p.nombre] || '' }))
        : [])
      const v = Array.isArray(turno.ventas) ? turno.ventas[0] : turno.ventas
      setVentas(v
        ? { efectivo: +v.efectivo || 0, getnet: +v.getnet || 0, mercadopago: +v.mercadopago || 0, edenred: +v.edenred || 0, amipass: +v.amipass || 0, transferencia: +v.transferencia || 0 }
        : VENTAS_VACIAS)
      setCambiosLocales(false)
      setCambioRemotoPendiente(false)
      } finally {
        if (activo) setCargandoDatos(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [tipo, loadKey, setProvs, setVentas, config.fondoCajaInicial])

  useEffect(() => {
    let activo = true
    async function detectar() {
      const { data: jornada } = await supabase
        .from('jornadas').select('id').eq('fecha', hoy()).maybeSingle()
      let existentes = []
      let drafts = {}
      setJornadaId(jornada?.id || null)
      if (jornada) {
        const { data: turnos } = await supabase
          .from('turnos').select('tipo, is_draft').eq('jornada_id', jornada.id).is('deleted_at', null)
        existentes = (turnos || []).map((t) => t.tipo)
        drafts = Object.fromEntries((turnos || []).map((t) => [t.tipo, !!t.is_draft]))
      }
      if (!activo) return
      setTiposExistentes(existentes)
      setTurnosDraft(drafts)
      if (tipoInicializadoRef.current) return
      tipoInicializadoRef.current = true
      if (esDiaUnico(hoy())) {
        setTipo('mañana')
      } else {
        // Un turno solo cuenta como "completado" (y por lo tanto candidato a
        // saltarse) si ya fue cerrado. Un borrador en progreso debe seguir
        // siendo el tipo activo al recargar la página, no saltar al siguiente.
        const completados = existentes.filter((t) => !drafts[t])
        const porHora = new Date().getHours() < config.horaCorteManana ? 'mañana' : 'tarde'
        if (!completados.includes('mañana')) setTipo('mañana')
        else if (!completados.includes('tarde')) setTipo('tarde')
        else setTipo(porHora)
      }
    }
    detectar()
    return () => { activo = false }
  }, [detectKey, config.horaCorteManana, esDiaUnico])

  const turnoExistente = tiposExistentes.includes(tipo)

  const refrescarDesdeRemoto = useCallback(() => {
    setError('')
    setCambioRemotoPendiente(false)
    setCambiosLocales(false)
    setDetectKey((k) => k + 1)
    setLoadKey((k) => k + 1)
  }, [])

  useJornadaRealtime({
    fecha: hoy(),
    jornadaId,
    turnoIds: turnoIdRef.current ? [turnoIdRef.current] : [],
    onChange: () => {
      if (savingRef.current) return         // es nuestro propio autosave
      if (cambiosLocales) {
        setCambioRemotoPendiente(true)
        return
      }
      setDetectKey((k) => k + 1)
      setLoadKey((k) => k + 1)
    },
  })

  useErrorToast(error)
  useConflictoRemoto(cambioRemotoPendiente, refrescarDesdeRemoto)

  useEffect(() => {
    Promise.all([
      supabase.from('proveedores_frecuentes').select('nombre, imagen_url'),
      supabase.from('proveedores_turno').select('nombre'),
    ]).then(([{ data: frecuentes }, { data: historial }]) => {
      if (!frecuentes) return
      const counts = {}
      for (const r of historial || []) counts[r.nombre] = (counts[r.nombre] || 0) + 1
      setSugerencias(frecuentes.sort((a, b) => {
        const diff = (counts[b.nombre] || 0) - (counts[a.nombre] || 0)
        return diff !== 0 ? diff : a.nombre.localeCompare(b.nombre)
      }))
    })
  }, [])

  useEffect(() => { fondoInicialRef.current = fondoInicial }, [fondoInicial])

  const { totalVentas, totalProveedores, efProv } = form
  const efectivoEsperado = fondoInicial + (ventas.efectivo || 0) - efProv
  const hayDatos = provs.length > 0 || totalVentas > 0
  const total = totalVentas
  // Un turno de hoy ya cerrado (no borrador) es de solo lectura en esta pantalla:
  // cualquier corrección debe pasar por Historial → Editar turno, para quedar
  // registrada en turno_cierres. Editar aquí directamente saltaría ese registro
  // de auditoría (el autoguardado escribe directo a ventas_turno/proveedores_turno).
  const turnoYaCerrado = turnoExistente && !turnosDraft[tipo]

  function cambiarTipo(t) {
    setProvs([])
    setVentas(VENTAS_VACIAS)
    setCambiosLocales(false)
    setCambioRemotoPendiente(false)
    setError('')
    setTipo(t)
  }

  // "Guardar turno"/"Listo": abre el paso de conteo físico de caja antes
  // de cerrar (el usuario puede omitirlo). re-sincroniza proveedores y
  // ventas por las dudas (ambos ya se autoguardan campo a campo, esto es
  // solo para asegurar el estado final antes de cerrar) y cierra el turno.
  async function finalizarTurno(efectivoContado = null) {
    if (totalVentas === 0) {
      setError('Ingresa las ventas del turno antes de guardar.')
      return
    }
    setFinalizando(true)
    startSaving()
    let ok = false
    await enqueueSave(async () => {
      const { turnoId: id } = await guardarTurno({
        fecha: hoy(), tipo, usuarioId: usuario.id, proveedores: provs, ventas, fondoInicial,
      })
      turnoIdRef.current = id
      await finalizarTurnoApi(id, efectivoContado)
      ok = true
    })
    endSaving()
    setFinalizando(false)
    if (!ok) return // enqueueSave ya mostró el error
    setTurnosDraft((prev) => ({ ...prev, [tipo]: false }))
    setCambiosLocales(false)
    setCambioRemotoPendiente(false)
    setShowConteoSheet(false)
    navigate('/hoy')
  }

  async function handleFondoGuardar(monto) {
    setFondoInicial(monto)
    setShowFondoSheet(false)
    if (turnoIdRef.current) {
      try { await actualizarFondoInicial(turnoIdRef.current, monto) } catch (err) { console.error(err); setError('No se pudo guardar el fondo de caja.') }
    }
    // Si el turno todavía no existe, el valor queda en fondoInicialRef
    // y se usará recién cuando se cree (primer autoguardado o cierre).
  }

  async function limpiar() {
    const idToDelete = turnoIdRef.current
    setProvs([]); setVentas(VENTAS_VACIAS); setError(''); setCambiosLocales(false); setCambioRemotoPendiente(false)
    turnoIdRef.current = null
    setTurnoIdExistente(null)
    setTurnosDraft((prev) => {
      const { [tipo]: _drop, ...rest } = prev
      return rest
    })
    if (idToDelete) {
      try { await eliminarTurno(idToDelete) } catch (err) { console.error(err) }
      setTiposExistentes((prev) => prev.filter((t) => t !== tipo))
    }
  }

  if (tipo === null) {
    return <Layout><div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div></Layout>
  }

  return (
    <Layout>
      <div className="max-w-lg md:max-w-4xl mx-auto space-y-4">
        <PageHeader
          title="Ingresar turno"
          date={fechaLegible(hoy())}
        />

        <SegmentedTipo
          tipo={tipo}
          tiposExistentes={tiposExistentes}
          turnosDraft={turnosDraft}
          esDiaUnico={esDiaUnico(hoy())}
          onChange={cambiarTipo}
        />

        {!turnoYaCerrado && (
          <div className="flex items-center justify-between gap-2">
            <div>
              {!online ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-warn">
                  <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
                  Sin conexión — se guardará al volver
                </span>
              ) : autoguardando ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
                  <span className="w-3 h-3 rounded-full border-2 border-muted2 border-t-transparent animate-spin" />
                  Guardando…
                </span>
              ) : cambiosLocales ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted2" />
                  Cambios sin guardar
                </span>
              ) : null}
            </div>
            {hayDatos && (
              <button
                onClick={() => setShowLimpiarConfirm(true)}
                className="text-xs font-medium text-neg hover:underline underline-offset-2"
              >
                {turnoExistente ? 'Eliminar turno' : 'Limpiar borrador'}
              </button>
            )}
          </div>
        )}

        {cargandoDatos ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
        ) : turnoYaCerrado ? (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <div className="w-16 h-16 rounded-full grid place-items-center bg-brand-tint text-brand">
              <Icon name="check" className="w-8 h-8" stroke={2.6} />
            </div>
            <div>
              <h2 className="font-display text-[26px] text-ink capitalize">Turno de {tipo} registrado</h2>
              <p className="text-sm text-muted mt-1">Ya fue cerrado. Para corregirlo, ve al resumen del día.</p>
            </div>
            <button onClick={() => navigate('/resumen')} className="btn-primary w-full py-3 text-base">
              Ver resumen del día
            </button>
          </div>
        ) : (
          <>
            {turnoExistente && turnosDraft[tipo] && (
              <div className="flex items-center gap-2 text-sm text-warn bg-warn-tint border border-warn/30 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-warn animate-pulse" />
                <span>Borrador en progreso — los cambios se guardan automáticamente.</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowFondoSheet(true)}
              className="w-full flex items-center justify-between rounded-2xl bg-card border border-hairline px-4 py-2.5 text-left hover:border-brand/30 transition-colors"
            >
              <span className="text-[13px] text-ink2">Fondo de caja</span>
              <span className="text-[13px] font-bold text-ink tabular-nums">
                {clp(fondoInicial)} <span className="text-muted2 font-medium">· editar</span>
              </span>
            </button>

            <div className="grid lg:grid-cols-2 gap-4 items-start">
              <VentasSection ventas={ventas} onEdit={form.openVenta} />
              <ProveedoresSection
                provs={provs}
                onAdd={form.openNew}
                onEdit={form.openEdit}
                accent={ACCENT}
                accentTint={ACCENT_TINT}
              />
            </div>
          </>
        )}
      </div>

      {!cargandoDatos && !turnoYaCerrado && (
        <TurnoBottomBar
          total={total}
          guardando={finalizando}
          disabled={cambioRemotoPendiente || totalVentas === 0}
          label={turnoExistente ? 'Listo' : 'Guardar turno'}
          onGuardar={() => setShowConteoSheet(true)}
        />
      )}
      <div className="pb-nav md:h-20" />

      <ConfirmDialog
        open={showLimpiarConfirm}
        title={turnoExistente ? '¿Eliminar el turno?' : '¿Limpiar el borrador?'}
        description={turnoExistente
          ? 'El turno se moverá a la papelera. El dueño podrá restaurarlo si fue un error.'
          : 'Se borrarán todos los proveedores y ventas ingresados en este borrador. Esta acción no se puede deshacer.'}
        confirmLabel="Limpiar"
        danger
        onCancel={() => setShowLimpiarConfirm(false)}
        onConfirm={() => { setShowLimpiarConfirm(false); limpiar() }}
      />

      <TurnoSheets
        sheet={form.sheet}
        setSheet={form.setSheet}
        isDesktop={isDesktop}
        sugerencias={sugerencias}
        usedNames={form.usedNames}
        commitProv={form.commitProv}
        commitVenta={form.commitVenta}
        delProv={form.delProv}
      />

      <FondoCajaSheet
        open={showFondoSheet}
        isDesktop={isDesktop}
        valorActual={fondoInicial}
        onGuardar={handleFondoGuardar}
        onClose={() => setShowFondoSheet(false)}
      />

      <ConteoCajaSheet
        open={showConteoSheet}
        isDesktop={isDesktop}
        efectivoEsperado={efectivoEsperado}
        guardando={finalizando}
        onConfirmar={(contado) => finalizarTurno(contado)}
        onOmitir={() => finalizarTurno(null)}
        onClose={() => setShowConteoSheet(false)}
      />
    </Layout>
  )
}
