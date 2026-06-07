import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useJornadaRealtime } from '../hooks/useJornadaRealtime'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { hoy, fechaLegible } from '../utils/format'
import {
  ACCENT, ACCENT_TINT, METODOS_VENTA, VENTAS_VACIAS, TurnoIcon as Icon,
} from '../components/TurnoInput'
import { useTurnoForm } from '../components/turno/useTurnoForm'
import { useIsDesktop } from '../components/turno/useIsDesktop'
import { ProveedoresSection, VentasSection } from '../components/turno/TurnoSections'
import { TurnoSheets } from '../components/turno/TurnoSheets'
import { TurnoBottomBar } from '../components/turno/TurnoBottomBar'
import { crearTurno, escribirTurno, versionTurno, borrarTurno } from '../components/turno/turnoApi'

export default function Turno() {
  const { usuario } = useAuth()
  const { esDiaUnico, config } = useConfig()
  const navigate = useNavigate()
  const toast = useToast()
  const isDesktop = useIsDesktop()

  const [tipo, setTipo] = useState(null)
  const [tiposExistentes, setTiposExistentes] = useState([])
  const [sugerencias, setSugerencias] = useState([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [draftRestaurado, setDraftRestaurado] = useState(false)
  const [showLimpiarConfirm, setShowLimpiarConfirm] = useState(false)
  const [turnoIdExistente, setTurnoIdExistente] = useState(null)
  const [turnoVersion, setTurnoVersion] = useState(null)
  const [jornadaId, setJornadaId] = useState(null)
  const [cambiosLocales, setCambiosLocales] = useState(false)
  const [cambioRemotoPendiente, setCambioRemotoPendiente] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [detectKey, setDetectKey] = useState(0)
  const guardandoRef = useRef(false)

  const form = useTurnoForm({ onDirty: () => setCambiosLocales(true) })
  const { provs, setProvs, ventas, setVentas } = form

  useEffect(() => { guardandoRef.current = guardando }, [guardando])

  const draftKey = useMemo(
    () => usuario?.id && tipo ? `turno-draft-${usuario.id}-${hoy()}-${tipo}` : null,
    [usuario?.id, tipo]
  )

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
  }, [tipo, tiposExistentes, loadKey, draftKey, setProvs, setVentas])

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

  const { efProv, totalVentas, totalProveedores } = form
  const hayDatos = provs.length > 0 || totalVentas > 0

  async function guardarTurno() {
    if (cambioRemotoPendiente) {
      setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
      return
    }
    setGuardando(true); setError('')
    try {
      if (turnoIdExistente) {
        if (turnoVersion && (await versionTurno(turnoIdExistente)) !== turnoVersion) {
          setCambioRemotoPendiente(true)
          setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
          return
        }
        await escribirTurno(turnoIdExistente, provs, ventas)
      } else {
        const nuevoId = await crearTurno({ fecha: hoy(), tipo, usuarioId: usuario.id, provs, ventas })
        setTiposExistentes((prev) => [...new Set([...prev, tipo])])
        mostrarDeshacer(nuevoId)
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

  function mostrarDeshacer(turnoId) {
    const tipoGuardado = tipo
    toast.show({
      message: `Turno de ${tipoGuardado} guardado`,
      actionLabel: 'Deshacer',
      onAction: async () => {
        await borrarTurno(turnoId)
        toast.show({ message: 'Registro deshecho', duration: 3000 })
      },
    })
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
      <div className="max-w-lg md:max-w-4xl mx-auto space-y-5">
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
            <div className="grid lg:grid-cols-2 gap-5 items-start">
              <ProveedoresSection
                provs={provs}
                onAdd={form.openNew}
                onEdit={form.openEdit}
                accent={ACCENT}
                accentTint={ACCENT_TINT}
              />
              <VentasSection ventas={ventas} onEdit={form.openVenta} />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">{error}</p>}
          </>
        )}
      </div>

      {!turnoExistente && (
        <TurnoBottomBar
          totalVentas={totalVentas}
          totalProveedores={totalProveedores}
          efProv={efProv}
          guardando={guardando}
          disabled={cambioRemotoPendiente}
          label="Guardar"
          onGuardar={guardarTurno}
        />
      )}
      <div className="pb-nav md:h-20" />

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
    </Layout>
  )
}
