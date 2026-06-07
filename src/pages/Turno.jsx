import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useJornadaRealtime } from '../hooks/useJornadaRealtime'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { clp, hoy, fechaLegible, parseNum } from '../utils/format'
import {
  ACCENT, ACCENT_TINT, GREEN, NAVY, METODOS_VENTA, VENTAS_VACIAS,
  applyKey, TurnoIcon as Icon, ProveedorAvatar, SectionHead,
  BottomSheet, FreqChips, AmountDisplay, PayToggle, Keypad, MetodoLogo, DesktopAmountInput,
} from '../components/TurnoInput'

export default function Turno() {
  const { usuario } = useAuth()
  const { esDiaUnico, config } = useConfig()
  const navigate = useNavigate()
  const [tipo, setTipo] = useState(null)
  const [tiposExistentes, setTiposExistentes] = useState([])
  const [provs, setProvs] = useState([])
  const [ventas, setVentas] = useState(VENTAS_VACIAS)
  const [sugerencias, setSugerencias] = useState([])
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [draftRestaurado, setDraftRestaurado] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showLimpiarConfirm, setShowLimpiarConfirm] = useState(false)
  const [turnoIdExistente, setTurnoIdExistente] = useState(null)
  const [turnoVersion, setTurnoVersion] = useState(null)
  const [jornadaId, setJornadaId] = useState(null)
  const [cambiosLocales, setCambiosLocales] = useState(false)
  const [cambioRemotoPendiente, setCambioRemotoPendiente] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [detectKey, setDetectKey] = useState(0)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )
  const guardandoRef = useRef(false)

  useEffect(() => {
    guardandoRef.current = guardando
  }, [guardando])

  const draftKey = useMemo(
    () => usuario?.id && tipo ? `turno-draft-${usuario.id}-${hoy()}-${tipo}` : null,
    [usuario?.id, tipo]
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!sheet || !isDesktop) return
    const onKey = (e) => { if (e.key === 'Escape') setSheet(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, isDesktop])

  // Restaurar borrador o cargar datos del turno ya guardado según corresponda
  useEffect(() => {
    if (!tipo) return
    if (!tiposExistentes.includes(tipo)) {
      setTurnoIdExistente(null)
      setTurnoVersion(null)
      setProvs([])
      setVentas(VENTAS_VACIAS)
      setCambioRemotoPendiente(false)
      setCambiosLocales(false)
      const raw = draftKey ? localStorage.getItem(draftKey) : null
      if (raw) {
        try {
          const { provs: p, ventas: v } = JSON.parse(raw)
          if (p?.length) { setProvs(p); setDraftRestaurado(true) }
          if (v) setVentas(v)
          setCambiosLocales(true)
        } catch {}
      }
      return
    }
    let activo = true
    setProvs([])
    setVentas(VENTAS_VACIAS)
    setDraftRestaurado(false)
    async function cargar() {
      const [{ data: jornada }, { data: frecuentes }] = await Promise.all([
        supabase.from('jornadas').select('id').eq('fecha', hoy()).maybeSingle(),
        supabase.from('proveedores_frecuentes').select('nombre, imagen_url'),
      ])
      if (!jornada || !activo) return
      setJornadaId(jornada.id)
      const imgMap = Object.fromEntries((frecuentes || []).map((f) => [f.nombre, f.imagen_url || '']))
      const { data: turno } = await supabase
        .from('turnos')
        .select('id, updated_at, proveedores:proveedores_turno(nombre, monto, forma_pago), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)')
        .eq('jornada_id', jornada.id)
        .eq('tipo', tipo)
        .maybeSingle()
      if (!activo || !turno) return
      setTurnoIdExistente(turno.id)
      setTurnoVersion(turno.updated_at)
      setProvs(turno.proveedores?.length
        ? turno.proveedores.map((p) => ({ nombre: p.nombre, monto: +p.monto, forma_pago: p.forma_pago, imagen_url: imgMap[p.nombre] || '' }))
        : [])
      const v = Array.isArray(turno.ventas) ? turno.ventas[0] : turno.ventas
      setVentas(v
        ? { efectivo: +v.efectivo || 0, getnet: +v.getnet || 0, mercadopago: +v.mercadopago || 0, edenred: +v.edenred || 0, amipass: +v.amipass || 0, transferencia: +v.transferencia || 0 }
        : VENTAS_VACIAS)
      setCambiosLocales(false)
      setCambioRemotoPendiente(false)
    }
    cargar()
    return () => { activo = false }
  }, [tipo, tiposExistentes, loadKey, draftKey])

  // Guardar borrador en localStorage (solo cuando el turno no está guardado aún)
  useEffect(() => {
    if (!tipo || tiposExistentes.includes(tipo)) return
    const totalV = METODOS_VENTA.reduce((s, m) => s + (ventas[m.key] || 0), 0)
    if (provs.length === 0 && totalV === 0) return
    if (draftKey) localStorage.setItem(draftKey, JSON.stringify({ provs, ventas }))
  }, [provs, ventas, tipo, tiposExistentes, draftKey])

  useEffect(() => {
    let activo = true
    async function detectar() {
      const { data: jornada } = await supabase
        .from('jornadas').select('id').eq('fecha', hoy()).maybeSingle()
      let existentes = []
      setJornadaId(jornada?.id || null)
      if (jornada) {
        const { data: turnos } = await supabase
          .from('turnos').select('tipo').eq('jornada_id', jornada.id)
        existentes = (turnos || []).map((t) => t.tipo)
      }
      if (!activo) return
      setTiposExistentes(existentes)
      if (esDiaUnico(hoy())) {
        setTipo('mañana')
      } else {
        const porHora = new Date().getHours() < config.horaCorteManana ? 'mañana' : 'tarde'
        if (!existentes.includes('mañana')) setTipo('mañana')
        else if (!existentes.includes('tarde')) setTipo('tarde')
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
    if (draftKey) localStorage.removeItem(draftKey)
    setDetectKey((k) => k + 1)
    setLoadKey((k) => k + 1)
  }, [draftKey])

  useJornadaRealtime({
    fecha: hoy(),
    jornadaId,
    turnoIds: turnoIdExistente ? [turnoIdExistente] : [],
    onChange: () => {
      if (guardandoRef.current) return
      if (cambiosLocales) {
        setCambioRemotoPendiente(true)
        setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
        return
      }
      setDetectKey((k) => k + 1)
      setLoadKey((k) => k + 1)
    },
  })

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

  const efProv = useMemo(() => provs.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + p.monto, 0), [provs])
  const trProv = useMemo(() => provs.filter((p) => p.forma_pago === 'transferencia').reduce((s, p) => s + p.monto, 0), [provs])
  const totalVentas = useMemo(() => METODOS_VENTA.reduce((s, m) => s + (ventas[m.key] || 0), 0), [ventas])
  const totalProveedores = efProv + trProv
  const hayDatos = provs.length > 0 || totalVentas > 0
  const usedNames = provs.map((p) => p.nombre)

  function openNew() { setSheet({ mode: 'prov', idx: -1, nombre: '', monto: '', forma_pago: 'efectivo', imagen_url: '' }) }
  function openEdit(i) {
    const p = provs[i]
    setSheet({ mode: 'prov', idx: i, nombre: p.nombre, monto: String(p.monto), forma_pago: p.forma_pago, imagen_url: p.imagen_url || '' })
  }
  function openVenta(key) { setSheet({ mode: 'venta', key, monto: ventas[key] ? String(ventas[key]) : '' }) }

  function commitProv() {
    const row = { nombre: sheet.nombre.trim() || 'Proveedor', monto: parseNum(sheet.monto), forma_pago: sheet.forma_pago, imagen_url: sheet.imagen_url }
    if (sheet.idx === -1) setProvs((p) => [...p, row])
    else setProvs((p) => p.map((x, i) => (i === sheet.idx ? row : x)))
    setCambiosLocales(true)
    setSheet(null)
  }
  function commitVenta() {
    setVentas((v) => ({ ...v, [sheet.key]: parseNum(sheet.monto) }))
    setCambiosLocales(true)
    setSheet(null)
  }
  function delProv(i) {
    setProvs((p) => p.filter((_, j) => j !== i))
    setCambiosLocales(true)
    setSheet(null)
  }

  async function guardarTurno() {
    if (cambioRemotoPendiente) {
      setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
      return
    }
    const proveedoresValidos = provs.filter((p) => p.nombre.trim() && p.monto > 0)
    setGuardando(true); setError('')
    try {
      if (turnoIdExistente) {
        const { data: versionActual, error: errVersion } = await supabase
          .from('turnos')
          .select('updated_at')
          .eq('id', turnoIdExistente)
          .maybeSingle()
        if (errVersion) throw errVersion
        if (turnoVersion && versionActual?.updated_at && versionActual.updated_at !== turnoVersion) {
          setCambioRemotoPendiente(true)
          setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
          return
        }
        const { error: errVentas } = await supabase.from('ventas_turno').update({
          efectivo: ventas.efectivo, getnet: ventas.getnet, mercadopago: ventas.mercadopago,
          edenred: ventas.edenred, amipass: ventas.amipass, transferencia: ventas.transferencia,
        }).eq('turno_id', turnoIdExistente)
        if (errVentas) throw errVentas
        const { error: errDeleteProv } = await supabase.from('proveedores_turno').delete().eq('turno_id', turnoIdExistente)
        if (errDeleteProv) throw errDeleteProv
        if (proveedoresValidos.length > 0) {
          const { error: errProv } = await supabase.from('proveedores_turno').insert(
            proveedoresValidos.map((p) => ({ turno_id: turnoIdExistente, nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago }))
          )
          if (errProv) throw errProv
        }
      } else {
        let jornadaId
        const { data: jEx } = await supabase.from('jornadas').select('id').eq('fecha', hoy()).maybeSingle()
        if (jEx) jornadaId = jEx.id
        else {
          const { data: nueva, error: e } = await supabase.from('jornadas').insert({ fecha: hoy() }).select('id').single()
          if (e) throw e
          jornadaId = nueva.id
        }
        const { data: turno, error: errTurno } = await supabase
          .from('turnos').insert({ jornada_id: jornadaId, tipo, usuario_id: usuario.id }).select('id, updated_at').single()
        if (errTurno) throw errTurno
        if (proveedoresValidos.length > 0) {
          const { error: errProv } = await supabase.from('proveedores_turno').insert(
            proveedoresValidos.map((p) => ({ turno_id: turno.id, nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago }))
          )
          if (errProv) throw errProv
          await supabase.from('proveedores_frecuentes')
            .upsert(
              proveedoresValidos.map((p) => ({ nombre: p.nombre.trim() })),
              { onConflict: 'nombre', ignoreDuplicates: true }
            )
        }
        const { error: errVentas } = await supabase.from('ventas_turno').insert({
          turno_id: turno.id, ...ventas,
        })
        if (errVentas) throw errVentas
        setTiposExistentes((prev) => [...new Set([...prev, tipo])])
      }
      if (draftKey) localStorage.removeItem(draftKey)
      setCambiosLocales(false)
      setCambioRemotoPendiente(false)
      navigate('/resumen')
    } catch (err) {
      console.error(err)
      setError(err?.code === '23505'
        ? `Otro usuario acaba de guardar el turno de ${tipo}. Actualiza la página.`
        : 'Error al guardar el turno. Inténtalo de nuevo.')
    } finally { setGuardando(false) }
  }

  function limpiar() {
    setProvs([]); setVentas(VENTAS_VACIAS); setError(''); setDraftRestaurado(false); setCambiosLocales(false); setCambioRemotoPendiente(false)
    if (draftKey) localStorage.removeItem(draftKey)
  }


  if (tipo === null) {
    return <Layout><div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-[#5C3317] dark:border-[#E8C9A8] border-t-transparent animate-spin" /></div></Layout>
  }

  return (
    <Layout>
      <div className="max-w-lg md:max-w-2xl mx-auto space-y-5">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 capitalize">{fechaLegible(hoy())}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-3">Ingresar turno</h1>
          {esDiaUnico(hoy()) ? (
            <div className="flex p-1 bg-gray-100 dark:bg-zinc-700 rounded-xl">
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-zinc-800 shadow-sm text-gray-900 dark:text-zinc-100">
                <Icon name="sun" className="w-4 h-4" /> mañana
                {tiposExistentes.includes('mañana') && <Icon name="check" className="w-3.5 h-3.5 text-green-500" stroke={2.5} />}
                <span className="text-xs text-gray-400 dark:text-zinc-500 font-normal">(turno único)</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-zinc-700 rounded-xl">
              {[['mañana', 'sun'], ['tarde', 'moon']].map(([t, ic]) => {
                const esActivo = tipo === t
                const yaRegistrado = tiposExistentes.includes(t)
                return (
                  <button key={t} onClick={() => {
                    setProvs([])
                    setVentas(VENTAS_VACIAS)
                    setCambiosLocales(false)
                    setCambioRemotoPendiente(false)
                    setError('')
                    setTipo(t)
                  }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium capitalize transition
                      ${esActivo ? 'bg-white dark:bg-zinc-800 shadow-sm text-gray-900 dark:text-zinc-100' : 'text-gray-500 dark:text-zinc-400'}`}>
                    <Icon name={ic} className="w-4 h-4" />{t}
                    {yaRegistrado && <Icon name="check" className="w-3.5 h-3.5 text-green-500" stroke={2.5} />}
                  </button>
                )
              })}
            </div>
          )}
          {!turnoExistente && hayDatos && (
            <div className="mt-1.5 flex justify-end">
              <button onClick={() => setShowLimpiarConfirm(true)} className="text-xs font-medium text-red-500 dark:text-red-400 hover:text-red-700 underline underline-offset-2">Limpiar borrador</button>
            </div>
          )}
          {draftRestaurado && (
            <div className="mt-2 flex items-center justify-between gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
              <span>Borrador restaurado automáticamente</span>
              <button onClick={() => setDraftRestaurado(false)} className="shrink-0 text-amber-500 hover:text-amber-700">
                <Icon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {cambioRemotoPendiente && (
            <div className="mt-2 flex items-center justify-between gap-3 text-sm text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <span>Hay cambios de otro usuario en este turno.</span>
              <button onClick={refrescarDesdeRemoto} className="shrink-0 font-semibold underline underline-offset-2">
                Recargar
              </button>
            </div>
          )}
        </div>

        {turnoExistente ? (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <div className="w-16 h-16 rounded-full grid place-items-center" style={{ background: ACCENT_TINT, color: ACCENT }}>
              <Icon name="check" className="w-8 h-8" stroke={2.6} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 capitalize">Turno de {tipo} registrado</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Para editarlo, ve al resumen del día.</p>
            </div>
            <button onClick={() => navigate('/resumen')} className="btn-primary w-full py-3">
              Ver resumen del día
            </button>
          </div>
        ) : (
          <>
            <section>
              <SectionHead title="Proveedores" right={provs.length || null} />
              {provs.length === 0 ? (
                <button onClick={openNew} className="w-full flex flex-col items-center gap-2 py-7 rounded-xl border border-dashed border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 text-sm font-medium">
                  <Icon name="plus" /> Agrega el primer proveedor
                </button>
              ) : (
                <>
                  <div className="card !p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700">
                    {provs.map((p, i) => (
                      <button key={i} onClick={() => openEdit(i)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                        <ProveedorAvatar nombre={p.nombre} imagen_url={p.imagen_url} size="sm" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-medium text-gray-900 dark:text-zinc-100 truncate">{p.nombre}</span>
                          <span className="block text-xs capitalize" style={{ color: p.forma_pago === 'efectivo' ? GREEN : NAVY }}>{p.forma_pago}</span>
                        </span>
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{clp(p.monto)}</span>
                        <Icon name="chevR" className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
                      </button>
                    ))}
                  </div>
                  <button onClick={openNew} className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                    style={{ background: ACCENT_TINT, color: ACCENT }}>
                    <Icon name="plus" className="w-4 h-4" stroke={2} /> Agregar proveedor
                  </button>
                </>
              )}
            </section>

            <section>
              <SectionHead title="Ventas del turno" />
              <div className="card !p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700">
                {METODOS_VENTA.map((m) => {
                  const tiene = ventas[m.key] > 0
                  return (
                    <button key={m.key} onClick={() => openVenta(m.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${tiene ? 'bg-[#F7FBF9] dark:bg-emerald-950/30' : ''}`}>
                      <MetodoLogo metodo={m} active={tiene} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-medium text-gray-900 dark:text-zinc-100">{m.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-zinc-400">{m.sub}</span>
                      </span>
                      <span className={`font-semibold tabular-nums ${tiene ? 'text-gray-900 dark:text-zinc-100' : 'text-gray-300 dark:text-zinc-600'}`}>{clp(ventas[m.key])}</span>
                      <Icon name="chevR" className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
                    </button>
                  )
                })}
              </div>
            </section>

            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">{error}</p>}
          </>
        )}
      </div>

      {!turnoExistente && (
      <div className="above-nav fixed inset-x-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 pt-3 safe-bottom z-30">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <div>
              <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-500">Ventas</p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">{clp(totalVentas)}</p>
            </div>
            {totalProveedores > 0 && (
              <>
                <span className="text-gray-200 dark:text-zinc-700 text-lg">|</span>
                <div>
                  <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-500">Proveedores</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: efProv > 0 ? GREEN : NAVY }}>{clp(totalProveedores)}</p>
                </div>
              </>
            )}
          </div>
        </div>
        <button onClick={() => setShowConfirm(true)} disabled={guardando || cambioRemotoPendiente}
          className="h-12 px-7 rounded-xl text-white font-semibold disabled:opacity-50 shrink-0 flex items-center gap-2"
          style={{ background: ACCENT }}>
          {guardando && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        </div>
      </div>
      )}
      <div className="pb-nav md:h-20" />

      {showConfirm && (
        <ConfirmModal
          tipo={tipo}
          fecha={hoy()}
          totalVentas={totalVentas}
          efProv={efProv}
          trProv={trProv}
          provs={provs.filter((p) => p.nombre.trim() && p.monto > 0)}
          onConfirm={() => { setShowConfirm(false); guardarTurno() }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showLimpiarConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowLimpiarConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">¿Limpiar el borrador?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                  Se borrarán todos los proveedores y ventas ingresados. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLimpiarConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button
                  onClick={() => { setShowLimpiarConfirm(false); limpiar() }}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition">
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {sheet && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSheet(null)} />}

      {/* ── Modal escritorio ───────────────────────────────── */}
      {sheet && isDesktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                {sheet.mode === 'venta'
                  ? `Ventas · ${METODOS_VENTA.find((m) => m.key === sheet.key).label}`
                  : sheet.idx === -1 ? 'Agregar proveedor' : 'Editar proveedor'}
              </h3>
              <div className="flex gap-2">
                {sheet.mode === 'prov' && sheet.idx !== -1 && (
                  <button onClick={() => delProv(sheet.idx)} className="w-8 h-8 rounded-full grid place-items-center bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                    <Icon name="trash" className="w-[18px] h-[18px]" />
                  </button>
                )}
                <button onClick={() => setSheet(null)} className="w-8 h-8 rounded-full grid place-items-center bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300">
                  <Icon name="close" className="w-[17px] h-[17px]" />
                </button>
              </div>
            </div>

            {/* Ventas */}
            {sheet.mode === 'venta' && (
              <>
                <DesktopAmountInput
                  value={sheet.monto}
                  onChange={(v) => setSheet((s) => ({ ...s, monto: v }))}
                  color={ACCENT}
                  label={METODOS_VENTA.find((m) => m.key === sheet.key).sub}
                  onEnter={commitVenta}
                />
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setSheet(null)} className="flex-1 btn-secondary">Cancelar</button>
                  <button onClick={commitVenta} disabled={parseNum(sheet.monto) === 0}
                    className="flex-1 btn-primary">
                    <Icon name="check" className="w-4 h-4" stroke={2.4} /> Listo
                  </button>
                </div>
              </>
            )}

            {/* Proveedor */}
            {sheet.mode === 'prov' && (
              <>
                <div className="relative">
                  <Icon name="store" className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-3.5" />
                  <input value={sheet.nombre} onChange={(e) => setSheet((s) => ({ ...s, nombre: e.target.value }))}
                    placeholder="Buscar o escribir proveedor" className="input !pl-10"
                    type="text" autoFocus autoComplete="off" autoCorrect="off"
                    autoCapitalize="words" spellCheck={false} />
                </div>
                <FreqChips query={sheet.nombre} used={usedNames} sugerencias={sugerencias}
                  onPick={(s) => setSheet((prev) => ({ ...prev, nombre: s.nombre, imagen_url: s.imagen_url || '' }))} />
                <DesktopAmountInput
                  value={sheet.monto}
                  onChange={(v) => setSheet((s) => ({ ...s, monto: v }))}
                  color={sheet.forma_pago === 'efectivo' ? GREEN : NAVY}
                  label="Monto"
                  autoFocus={false}
                  onEnter={commitProv}
                />
                <PayToggle value={sheet.forma_pago} onChange={(fp) => setSheet((s) => ({ ...s, forma_pago: fp }))} />
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setSheet(null)} className="flex-1 btn-secondary">Cancelar</button>
                  <button onClick={commitProv} disabled={parseNum(sheet.monto) === 0}
                    className="flex-1 btn-primary">
                    <Icon name="check" className="w-4 h-4" stroke={2.4} />
                    {sheet.idx === -1 ? 'Agregar proveedor' : 'Guardar cambios'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modales móvil (BottomSheet) ────────────────────── */}
      {sheet && !isDesktop && (
        <>
          {sheet.mode === 'prov' && (
            <BottomSheet
              title={sheet.idx === -1 ? 'Agregar proveedor' : 'Editar proveedor'}
              onClose={() => setSheet(null)}
              extra={sheet.idx !== -1 && (
                <button onClick={() => delProv(sheet.idx)} className="w-8 h-8 rounded-full grid place-items-center bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                  <Icon name="trash" className="w-[18px] h-[18px]" />
                </button>
              )}>
              <div className="relative">
                <Icon name="store" className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-3.5" />
                <input value={sheet.nombre} onChange={(e) => setSheet((s) => ({ ...s, nombre: e.target.value }))}
                  placeholder="Buscar o escribir proveedor" className="input !pl-10"
                  type="text" inputMode="text" autoComplete="off" autoCorrect="off"
                  autoCapitalize="words" spellCheck={false} />
              </div>
              <FreqChips query={sheet.nombre} used={usedNames} sugerencias={sugerencias}
                onPick={(s) => setSheet((prev) => ({ ...prev, nombre: s.nombre, imagen_url: s.imagen_url || '' }))} />
              <AmountDisplay value={sheet.monto} color={sheet.forma_pago === 'efectivo' ? GREEN : NAVY} />
              <PayToggle value={sheet.forma_pago} onChange={(fp) => setSheet((s) => ({ ...s, forma_pago: fp }))} />
              <Keypad onKey={(k) => setSheet((s) => ({ ...s, monto: applyKey(s.monto, k) }))}
                onAccept={commitProv} disabled={parseNum(sheet.monto) === 0}
                accent={sheet.forma_pago === 'efectivo' ? GREEN : NAVY}
                label={sheet.idx === -1 ? 'Agregar proveedor' : 'Guardar cambios'} />
            </BottomSheet>
          )}
          {sheet.mode === 'venta' && (
            <BottomSheet title={`Ventas · ${METODOS_VENTA.find((m) => m.key === sheet.key).label}`} onClose={() => setSheet(null)}>
              <AmountDisplay value={sheet.monto} sub={METODOS_VENTA.find((m) => m.key === sheet.key).sub} />
              <Keypad onKey={(k) => setSheet((s) => ({ ...s, monto: applyKey(s.monto, k) }))}
                onAccept={commitVenta} accent={ACCENT} label="Listo" />
            </BottomSheet>
          )}
        </>
      )}
    </Layout>
  )
}

function ResumenRow({ label, valor, color = '#111827' }) {
  return (
    <div className="flex justify-between py-2.5 px-4">
      <span className="text-sm text-gray-600 dark:text-zinc-300">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color }}>{valor}</span>
    </div>
  )
}

function ConfirmModal({ tipo, fecha, totalVentas, efProv, trProv, provs, onConfirm, onCancel }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-4 p-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 capitalize">Confirmar turno de {tipo}</h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400">{fechaLegible(fecha)}</p>
          </div>
          <div className="card !p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700">
            <ResumenRow label="Ventas del turno" valor={clp(totalVentas)} />
            {efProv > 0 && <ResumenRow label="Proveedores efectivo" valor={clp(efProv)} color={GREEN} />}
            {trProv > 0 && <ResumenRow label="Proveedores transferencia" valor={clp(trProv)} color={NAVY} />}
            {totalVentas === 0 && efProv === 0 && trProv === 0 && (
              <p className="text-sm text-gray-400 dark:text-zinc-500 px-4 py-3">No hay datos ingresados. Se guardará el turno vacío.</p>
            )}
          </div>
          {provs.length > 0 && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto -mx-1 px-1">
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">{provs.length} proveedor{provs.length !== 1 ? 'es' : ''}</p>
              {provs.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-zinc-300 truncate">{p.nombre}</span>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: p.forma_pago === 'efectivo' ? GREEN : NAVY }}>
                    {clp(p.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} className="flex-1 btn-secondary">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 btn-primary">
              <TurnoIconInline name="check" /> Confirmar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function TurnoIconInline({ name }) {
  const paths = { check: 'M4 12.5l5 5L20 6.5' }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"
      stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}
