import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import { clp, fechaLegible, parseNum } from '../utils/format'
import {
  ACCENT, ACCENT_TINT, GREEN, NAVY, METODOS_VENTA, VENTAS_VACIAS,
  applyKey, TurnoIcon as Icon, ProveedorAvatar, SectionHead,
  BottomSheet, FreqChips, AmountDisplay, PayToggle, Keypad, MetodoLogo, DesktopAmountInput,
} from '../components/TurnoInput'

export default function EditarTurno() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fecha = params.get('fecha') || ''
  const tipo = params.get('tipo') || 'mañana'

  const [cargando, setCargando] = useState(true)
  const [turnoId, setTurnoId] = useState(null)     // null = modo crear, uuid = modo editar
  const [provs, setProvs] = useState([])
  const [ventas, setVentas] = useState(VENTAS_VACIAS)
  const [sugerencias, setSugerencias] = useState([])
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [showGuardarVacioConfirm, setShowGuardarVacioConfirm] = useState(false)
  const [showEliminarConfirm, setShowEliminarConfirm] = useState(false)
  const [turnoVersion, setTurnoVersion] = useState(null)
  const [cambioRemotoPendiente, setCambioRemotoPendiente] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
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

  /* Validar params */
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha)

  /* Cargar sugerencias */
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

  /* Cargar turno existente (si hay) */
  useEffect(() => {
    if (!fechaValida) { setCargando(false); return }
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      const { data: jornada, error: errJornada } = await supabase
        .from('jornadas').select('id').eq('fecha', fecha).maybeSingle()

      if (!activo) return
      if (errJornada) {
        setError('No se pudo cargar la jornada. Revisa tu conexión e inténtalo de nuevo.')
        setCargando(false); return
      }
      if (!jornada) { setCargando(false); return }

      const { data: turno, error: errTurno } = await supabase
        .from('turnos')
        .select('id, updated_at, proveedores:proveedores_turno(nombre, monto, forma_pago), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)')
        .eq('jornada_id', jornada.id)
        .eq('tipo', tipo)
        .maybeSingle()

      if (!activo) return
      if (errTurno) {
        setError('No se pudieron cargar los datos del turno. Revisa tu conexión e inténtalo de nuevo.')
        setCargando(false); return
      }
      if (turno) {
        setTurnoId(turno.id)
        setTurnoVersion(turno.updated_at)
        setCambioRemotoPendiente(false)
        const v = Array.isArray(turno.ventas) ? turno.ventas[0] : turno.ventas
        if (v) setVentas({ efectivo: +v.efectivo || 0, getnet: +v.getnet || 0, mercadopago: +v.mercadopago || 0, edenred: +v.edenred || 0, amipass: +v.amipass || 0, transferencia: +v.transferencia || 0 })
        if (turno.proveedores?.length) {
          setProvs(turno.proveedores.map((p) => ({
            nombre: p.nombre, monto: +p.monto, forma_pago: p.forma_pago, imagen_url: '',
          })))
        }
      }
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [fecha, tipo, fechaValida, loadKey])

  /* Totales */
  const efProv = useMemo(() => provs.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + p.monto, 0), [provs])
  const trProv = useMemo(() => provs.filter((p) => p.forma_pago === 'transferencia').reduce((s, p) => s + p.monto, 0), [provs])
  const totalVentas = useMemo(() => METODOS_VENTA.reduce((s, m) => s + (ventas[m.key] || 0), 0), [ventas])
  const totalProveedores = efProv + trProv
  const usedNames = provs.map((p) => p.nombre)

  /* Acciones de sheet */
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
    setSheet(null)
  }
  function commitVenta() { setVentas((v) => ({ ...v, [sheet.key]: parseNum(sheet.monto) })); setSheet(null) }
  function delProv(i) { setProvs((p) => p.filter((_, j) => j !== i)); setSheet(null) }

  function recargarDesdeRemoto() {
    setError('')
    setCambioRemotoPendiente(false)
    setLoadKey((k) => k + 1)
  }

  /* Guardar — crea o actualiza */
  async function guardar(forzar = false) {
    if (cambioRemotoPendiente) {
      setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
      return
    }
    const proveedoresValidos = provs.filter((p) => p.nombre.trim() && p.monto > 0)
    if (proveedoresValidos.length === 0 && totalVentas === 0 && !forzar) {
      setShowGuardarVacioConfirm(true)
      return
    }
    setGuardando(true); setError('')
    try {
      if (turnoId) {
        /* ── MODO EDITAR ── */
        const { data: versionActual, error: errVersion } = await supabase
          .from('turnos')
          .select('updated_at')
          .eq('id', turnoId)
          .maybeSingle()
        if (errVersion) throw errVersion
        if (turnoVersion && versionActual?.updated_at && versionActual.updated_at !== turnoVersion) {
          setCambioRemotoPendiente(true)
          setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
          return
        }

        // 1. Actualizar ventas
        const { error: errVentas } = await supabase.from('ventas_turno').update({
          efectivo: ventas.efectivo, getnet: ventas.getnet, mercadopago: ventas.mercadopago,
          edenred: ventas.edenred, amipass: ventas.amipass, transferencia: ventas.transferencia,
        }).eq('turno_id', turnoId)
        if (errVentas) throw errVentas

        // 2. Reemplazar proveedores: borrar los existentes e insertar los nuevos
        const { error: errDeleteProv } = await supabase.from('proveedores_turno').delete().eq('turno_id', turnoId)
        if (errDeleteProv) throw errDeleteProv
        if (proveedoresValidos.length > 0) {
          const { error: errProv } = await supabase.from('proveedores_turno').insert(
            proveedoresValidos.map((p) => ({ turno_id: turnoId, nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago }))
          )
          if (errProv) throw errProv
        }
      } else {
        /* ── MODO CREAR HISTÓRICO ── */
        // 1. Obtener o crear jornada para la fecha
        let jornadaId
        const { data: jEx } = await supabase.from('jornadas').select('id').eq('fecha', fecha).maybeSingle()
        if (jEx) jornadaId = jEx.id
        else {
          const { data: nueva, error: e } = await supabase.from('jornadas').insert({ fecha }).select('id').single()
          if (e) throw e
          jornadaId = nueva.id
        }

        // 2. Crear turno (el usuario_id es el dueño que lo está cargando)
        const { data: turno, error: errTurno } = await supabase
          .from('turnos').insert({ jornada_id: jornadaId, tipo, usuario_id: usuario.id }).select('id').single()
        if (errTurno) throw errTurno

        // 3. Proveedores
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

        // 4. Ventas
        const { error: errVentas } = await supabase.from('ventas_turno').insert({ turno_id: turno.id, ...ventas })
        if (errVentas) throw errVentas
      }

      navigate('/resumen', { state: { fecha } })
    } catch (err) {
      console.error(err)
      setError(err?.code === '23505'
        ? `Ya existe el turno de ${tipo} para esa fecha.`
        : 'Error al guardar. Inténtalo de nuevo.')
    } finally { setGuardando(false) }
  }

  /* Eliminar turno */
  async function eliminarTurno() {
    if (!turnoId) return
    const { error: err } = await supabase.from('turnos').delete().eq('id', turnoId)
    if (err) { setError('Error al eliminar el turno.'); return }
    navigate('/historial')
  }

  if (!fechaValida) {
    return (
      <Layout>
        <div className="card text-center text-gray-400 dark:text-zinc-500 py-12">
          Fecha inválida. Accedé desde el Historial.
        </div>
      </Layout>
    )
  }

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  const modoEditar = !!turnoId
  const icono = tipo === 'mañana' ? 'sun' : 'moon'

  return (
    <Layout>
      <div className="max-w-lg md:max-w-2xl mx-auto space-y-5">
        {/* Encabezado */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 capitalize">{fechaLegible(fecha)}</p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <Icon name={icono} className="w-6 h-6" />
              <span className="capitalize">{tipo}</span>
            </h1>
            <div className="flex items-center gap-2">
              {modoEditar && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                  Editando
                </span>
              )}
              {modoEditar && (
                <button onClick={() => setShowEliminarConfirm(true)}
                  className="w-8 h-8 rounded-full grid place-items-center bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition"
                  title="Eliminar turno">
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Proveedores */}
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

        {/* Ventas */}
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
        {cambioRemotoPendiente && (
          <div className="flex items-center justify-between gap-3 text-sm text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
            <span>Hay cambios de otro usuario en este turno.</span>
            <button onClick={recargarDesdeRemoto} className="shrink-0 font-semibold underline underline-offset-2">
              Recargar
            </button>
          </div>
        )}
      </div>

      {/* Barra inferior */}
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
        <button onClick={guardar} disabled={guardando || cambioRemotoPendiente}
          className="h-12 px-7 rounded-xl text-white font-semibold disabled:opacity-50 shrink-0 flex items-center gap-2"
          style={{ background: ACCENT }}>
          {guardando && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {guardando ? 'Guardando…' : modoEditar ? 'Guardar cambios' : 'Registrar turno'}
        </button>
        </div>
      </div>
      <div className="pb-nav md:h-20" />

      {/* Overlay */}
      {sheet && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSheet(null)} />}

      {/* ── Modal escritorio ── */}
      {sheet && isDesktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-4 p-6">
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
                  <button onClick={commitVenta} disabled={parseNum(sheet.monto) === 0} className="flex-1 btn-primary">
                    <Icon name="check" className="w-4 h-4" stroke={2.4} /> Listo
                  </button>
                </div>
              </>
            )}

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
                  <button onClick={commitProv} disabled={parseNum(sheet.monto) === 0} className="flex-1 btn-primary">
                    <Icon name="check" className="w-4 h-4" stroke={2.4} />
                    {sheet.idx === -1 ? 'Agregar proveedor' : 'Guardar cambios'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modales móvil (BottomSheet) ── */}
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

      {/* Modal guardar turno vacío */}
      {showGuardarVacioConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowGuardarVacioConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">¿Guardar turno vacío?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">No hay proveedores ni ventas ingresados.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowGuardarVacioConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button onClick={() => { setShowGuardarVacioConfirm(false); guardar(true) }} className="flex-1 btn-primary">Guardar igual</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal eliminar turno */}
      {showEliminarConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowEliminarConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base capitalize">¿Eliminar turno de {tipo}?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                  Se eliminarán todos los datos de este turno. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEliminarConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button
                  onClick={() => { setShowEliminarConfirm(false); eliminarTurno() }}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
