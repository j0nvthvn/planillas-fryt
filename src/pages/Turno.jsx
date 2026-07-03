import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useJornadaRealtime } from '../hooks/useJornadaRealtime'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import { hoy, fechaLegible, clp } from '../utils/format'
import {
  ACCENT, ACCENT_TINT, METODOS_VENTA, VENTAS_VACIAS, TurnoIcon as Icon,
} from '../components/TurnoInput'
import { useTurnoForm } from '../components/turno/useTurnoForm'
import { useIsDesktop } from '../components/turno/useIsDesktop'
import { ProveedoresSection, VentasSection } from '../components/turno/TurnoSections'
import { TurnoSheets } from '../components/turno/TurnoSheets'
import { TurnoBottomBar } from '../components/turno/TurnoBottomBar'
import { crearTurno, escribirTurno, versionTurno, borrarTurno } from '../components/turno/turnoApi'

function SegmentedTipo({ tipo, tiposExistentes, esDiaUnico, onChange }) {
  if (esDiaUnico) {
    return (
      <div className="flex p-1 bg-brand-tint rounded-[15px]">
        <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[11px] text-[14px] font-semibold bg-white text-ink shadow-sm">
          <Icon name="sun" className="w-4 h-4" stroke={1.8} />
          Mañana
          {tiposExistentes.includes('mañana') && (
            <Icon name="check" className="w-3.5 h-3.5 text-pos" stroke={2.5} />
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
        const yaRegistrado = tiposExistentes.includes(t)
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[11px] text-[14px] font-semibold capitalize transition ${
              esActivo
                ? 'bg-white text-ink shadow-sm'
                : 'text-muted hover:text-ink2'
            }`}
          >
            <Icon name={ic} className="w-4 h-4" stroke={esActivo ? 1.8 : 1.6} />
            {t}
            {yaRegistrado && (
              <Icon name="check" className="w-3.5 h-3.5 text-pos" stroke={2.5} />
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

  const { totalVentas, totalProveedores } = form
  const hayDatos = provs.length > 0 || totalVentas > 0
  const total = totalVentas

  function cambiarTipo(t) {
    setProvs([])
    setVentas(VENTAS_VACIAS)
    setCambiosLocales(false)
    setCambioRemotoPendiente(false)
    setError('')
    setTipo(t)
  }

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
      navigate('/hoy')
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
          esDiaUnico={esDiaUnico(hoy())}
          onChange={cambiarTipo}
        />

        {!turnoExistente && hayDatos && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowLimpiarConfirm(true)}
              className="text-xs font-medium text-neg hover:underline underline-offset-2"
            >
              Limpiar borrador
            </button>
          </div>
        )}

        {draftRestaurado && (
          <div className="flex items-center justify-between gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span>Borrador restaurado automáticamente</span>
            <button onClick={() => setDraftRestaurado(false)} className="shrink-0 text-amber-500 hover:text-amber-700">
              <Icon name="close" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {cambioRemotoPendiente && (
          <div className="flex items-center justify-between gap-3 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span>Hay cambios de otro usuario en este turno.</span>
            <button onClick={refrescarDesdeRemoto} className="shrink-0 font-semibold underline underline-offset-2">
              Recargar
            </button>
          </div>
        )}

        {turnoExistente ? (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <div className="w-16 h-16 rounded-full grid place-items-center bg-brand-tint text-brand">
              <Icon name="check" className="w-8 h-8" stroke={2.6} />
            </div>
            <div>
              <h2 className="font-display text-[26px] text-ink capitalize">Turno de {tipo} registrado</h2>
              <p className="text-sm text-muted mt-1">Para editarlo, ve al resumen del día.</p>
            </div>
            <button onClick={() => navigate('/hoy')} className="btn-primary w-full py-3 text-base">
              Ver resumen del día
            </button>
          </div>
        ) : (
          <>
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
            {error && (
              <p className="text-sm text-neg bg-neg-tint border border-neg/20 rounded-lg px-4 py-3">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {!turnoExistente && (
        <TurnoBottomBar
          total={total}
          guardando={guardando}
          disabled={cambioRemotoPendiente}
          label="Guardar turno"
          onGuardar={guardarTurno}
        />
      )}
      <div className="pb-nav md:h-20" />

      {showLimpiarConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowLimpiarConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-ink text-base">¿Limpiar el borrador?</p>
                <p className="text-sm text-ink2 mt-1">
                  Se borrarán todos los proveedores y ventas ingresados. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLimpiarConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button
                  onClick={() => { setShowLimpiarConfirm(false); limpiar() }}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold bg-neg hover:opacity-90 transition"
                >
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
