import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Amount from '../components/Amount'
import { clp, fechaLegible, hoy } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'
import Icon from '../components/Icon'
import TurnoStatusChip from '../components/TurnoStatusChip'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useJornadaRealtime } from '../hooks/useJornadaRealtime'
import { MetodoLogo, METODOS_VENTA } from '../components/TurnoInput'
import { CorreccionModal } from '../components/turno/CorreccionModal'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'

const FORM_COLORS = { efectivo: '#1E7A4F', transferencia: '#33518C' }

export default function Resumen({ fecha: fechaProp, esDuenoOverride, onBack }) {
  const { esDueno } = useAuth()
  const { esDiaUnico } = useConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const puedeEditar = esDuenoOverride ?? esDueno
  const editState = onBack ? { from: 'historial' } : undefined
  const [fecha, setFecha] = useState(() => fechaProp || location.state?.fecha || hoy())
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [jornadaEsUnica, setJornadaEsUnica] = useState(false)
  const [showMergeConfirm, setShowMergeConfirm] = useState(false)
  const [showDesmarcarConfirm, setShowDesmarcarConfirm] = useState(false)
  const [turnoCorreccion, setTurnoCorreccion] = useState(null)
  const [showSelectorCorreccion, setShowSelectorCorreccion] = useState(false)
  const dateInputRef = useRef(null)

  function irAnterior() {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setFecha(d.toISOString().split('T')[0])
  }
  function irSiguiente() {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setFecha(d.toISOString().split('T')[0])
  }

  const esFechaHoy = fecha >= hoy()

  const cargarDatos = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true)
    const { data: jornada } = await supabase
      .from('jornadas')
      .select('id, es_turno_unico')
      .eq('fecha', fecha)
      .maybeSingle()

    if (!jornada) {
      setDatos({ jornada: null, turnos: [] })
      setJornadaEsUnica(false)
      setCargando(false)
      return
    }
    setJornadaEsUnica(jornada.es_turno_unico ?? false)

    const { data: turnos } = await supabase
      .from('turnos')
      .select(`
        id, tipo, is_draft, creado_en,
        usuario:usuarios(nombre),
        proveedores:proveedores_turno(nombre, monto, forma_pago),
        ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
        cierres:turno_cierres(
          es_correccion, cerrado_en, efectivo_esperado, efectivo_contado, diferencia_efectivo,
          ventas_snapshot, proveedores_snapshot, total_ventas, total_proveedores,
          cerrado_por_usuario:usuarios!cerrado_por(nombre)
        )
      `)
      .eq('jornada_id', jornada.id)
      .order('tipo')

    setDatos({ jornada, turnos: turnos || [] })
    setCargando(false)
  }, [fecha])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const turnoIds = useMemo(() => datos?.turnos?.map((t) => t.id) || [], [datos?.turnos])

  useJornadaRealtime({
    fecha,
    jornadaId: datos?.jornada?.id,
    turnoIds,
    onChange: () => cargarDatos({ silencioso: true }),
  })

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  const { turnos } = datos

  const esTurnoUnico = esDiaUnico(fecha) || jornadaEsUnica

  async function toggleTurnoUnico() {
    if (!datos.jornada?.id) return
    const nuevo = !jornadaEsUnica
    await supabase.from('jornadas').update({ es_turno_unico: nuevo }).eq('id', datos.jornada.id)
    setJornadaEsUnica(nuevo)
  }

  const turnoMañana = turnos.find((t) => t.tipo === 'mañana')
  const turnoTarde = turnos.find((t) => t.tipo === 'tarde')

  const vm = totalesVentas(turnoMañana?.ventas)
  const vt = totalesVentas(turnoTarde?.ventas)
  const pm = totalesProveedores(turnoMañana?.proveedores)
  const pt = totalesProveedores(turnoTarde?.proveedores)

  const totalVentas = vm.total + vt.total
  const totalProveedores = pm.total + pt.total
  const ambosPresentes = turnoMañana && turnoTarde
  const ventasNetas = totalVentas - totalProveedores

  const turnosCorregidos = turnos.filter((t) => (t.cierres || []).some((c) => c.es_correccion))

  function abrirCorreccion() {
    if (turnosCorregidos.length === 1) setTurnoCorreccion(turnosCorregidos[0])
    else setShowSelectorCorreccion(true)
  }

  const cuadres = turnos
    .map((t) => {
      const cierres = t.cierres || []
      if (cierres.length === 0) return null
      const ultimo = cierres.reduce((a, b) => (new Date(b.cerrado_en) > new Date(a.cerrado_en) ? b : a))
      if (ultimo.efectivo_contado === null || ultimo.efectivo_contado === undefined) return null
      return { tipo: t.tipo, ...ultimo }
    })
    .filter(Boolean)

  const todosProveedores = [
    ...(turnoMañana?.proveedores || []).map((p) => ({ ...p, turno: 'Mañana' })),
    ...(turnoTarde?.proveedores || []).map((p) => ({ ...p, turno: 'Tarde' })),
  ]

  const estadoLabel = jornadaEsUnica
    ? 'Turno único'
    : ambosPresentes
      ? 'Completo'
      : 'Parcial'

  const esCompleto = jornadaEsUnica || ambosPresentes

  return (
    <Layout>
      <div className="max-w-screen-2xl mx-auto space-y-3.5">
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"
          >
            <Icon name="arrowLeft" className="w-4 h-4" stroke={2} />
            Historial
          </button>
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"
          >
            <Icon name="arrowLeft" className="w-4 h-4" stroke={2} />
            Volver
          </button>
        )}

        <PageHeader
          title="Resumen del día"
          date={fechaLegible(fecha)}
        />

        {/* Date navigator */}
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={irAnterior}
            className="w-9 h-9 rounded-full border border-hairline bg-card grid place-items-center text-ink2 hover:border-brand hover:text-brand transition-colors">
              <Icon name="chevL" className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => dateInputRef.current?.showPicker()}
            className="w-9 h-9 rounded-full border border-hairline bg-card grid place-items-center text-ink2 hover:border-brand hover:text-brand transition-colors"
            title="Ir a una fecha">
              <Icon name="calendar" className="w-4 h-4" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={fecha}
              max={hoy()}
              onChange={(e) => { if (e.target.value) setFecha(e.target.value) }}
              className="absolute inset-0 opacity-0 pointer-events-none"
            />
          </div>
          <button onClick={irSiguiente} disabled={esFechaHoy}
            className="w-9 h-9 rounded-full border border-hairline bg-card grid place-items-center text-ink2 hover:border-brand hover:text-brand transition-colors disabled:opacity-30 disabled:pointer-events-none">
            <Icon name="chevR" className="w-4 h-4" />
          </button>
        </div>

        {turnos.length === 0 && (
          <div className="card text-center text-muted py-12">
            No hay turnos registrados para este día.
          </div>
        )}

        {/* Chips estado turnos */}
        {turnos.length > 0 && (
          <div className="flex gap-2.5 items-start">
            <TurnoStatusChip
              tipo="mañana"
              presente={!!turnoMañana}
              usuario={turnoMañana?.usuario?.nombre}
            />
            {!esTurnoUnico && (
              <TurnoStatusChip
                tipo="tarde"
                presente={!!turnoTarde}
                usuario={turnoTarde?.usuario?.nombre}
              />
            )}
          </div>
        )}

        {/* Acciones de edición: editar / agregar / fusionar / desmarcar */}
        {puedeEditar && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            {!esTurnoUnico && datos.jornada && turnoMañana && !turnoTarde && (
              <button
                onClick={() => setShowMergeConfirm(true)}
                className="flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-[13px] font-semibold border border-hairline text-ink2 bg-card hover:border-brand/40 hover:text-brand transition-colors w-full sm:w-auto"
              >
                <Icon name="merge" className="w-4 h-4" stroke={1.8} />
                Fusionar en turno único
              </button>
            )}
            <button
              onClick={() => navigate(`/turno/editar?fecha=${fecha}&tipo=mañana`, { state: editState })}
              className="flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-[13px] font-semibold bg-brand-tint text-brand border border-brand/30 w-full sm:w-auto"
            >
              <Icon name={turnoMañana ? 'edit' : 'plus'} className="w-4 h-4" stroke={1.8} />
              {turnoMañana ? 'Editar mañana' : 'Agregar mañana'}
            </button>
            {!esTurnoUnico && (
              <button
                onClick={() => navigate(`/turno/editar?fecha=${fecha}&tipo=tarde`, { state: editState })}
                className="flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-[13px] font-semibold bg-brand-tint text-brand border border-brand/30 w-full sm:w-auto"
              >
                <Icon name={turnoTarde ? 'edit' : 'plus'} className="w-4 h-4" stroke={1.8} />
                {turnoTarde ? 'Editar tarde' : 'Agregar tarde'}
              </button>
            )}
            {jornadaEsUnica && !esDiaUnico(fecha) && (
              <button
                onClick={() => setShowDesmarcarConfirm(true)}
                className="flex items-center justify-center rounded-xl py-2 px-3 text-[13px] font-semibold border border-hairline text-ink2 bg-card hover:border-brand/40 hover:text-brand transition-colors w-full sm:w-auto"
              >
                Desmarcar turno único
              </button>
            )}
          </div>
        )}

        {/* Ventas por método */}
        {turnos.length > 0 && totalVentas > 0 && (
          <div className="card">
            <p className="eyebrow mb-3">Ventas por método de pago</p>
            <div className="space-y-2.5">
              {METODOS_VENTA.filter((m) => (vm[m.key] || 0) + (vt[m.key] || 0) > 0).map((m) => (
                <div key={m.key} className="flex items-center gap-2.5">
                  <MetodoLogo metodo={m} size="sm" />
                  <span className="flex-1 text-[13px] text-ink2">{m.label}</span>
                  <span className="text-[13px] font-bold text-ink tabular-nums">
                    {clp((vm[m.key] || 0) + (vt[m.key] || 0))}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2.5 pt-3 border-t border-soft mt-1">
                <span className="flex-1 text-[14px] font-bold text-ink">Total ventas</span>
                <Amount variant="card" color="brand" value={totalVentas} />
              </div>
            </div>
          </div>
        )}

        {/* Balance del día */}
        {turnos.length > 0 && (
          <div className="card-hero">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <p className="eyebrow">Balance del día</p>
              <div className="flex items-center gap-1.5">
                {turnos.some((t) => t.is_draft) && (
                  <Badge tone="warn" dot>Borrador</Badge>
                )}
                {turnosCorregidos.length > 0 && (
                  <Badge tone="info" icon="edit" onClick={abrirCorreccion}>Corregido</Badge>
                )}
                <Badge tone={esCompleto ? 'pos' : 'warn'}>{estadoLabel}</Badge>
              </div>
            </div>
            <Amount variant="hero" color={ventasNetas >= 0 ? 'pos' : 'neg'} value={ventasNetas} className="mt-1" />
            <p className="text-[12px] text-muted mt-2">
              {clp(totalVentas)} ventas − {clp(totalProveedores)} proveedores
            </p>
          </div>
        )}

        {/* Cuadre de caja (conteo físico vs. esperado) */}
        {cuadres.length > 0 && (
          <div className="card">
            <p className="eyebrow mb-3">Cuadre de caja</p>
            <div className="space-y-3">
              {cuadres.map((c) => {
                const dif = +c.diferencia_efectivo
                const color = dif === 0 ? 'text-pos' : dif > 0 ? 'text-info' : 'text-neg'
                const label = dif === 0 ? 'Cuadra exacto' : dif > 0 ? `Sobran ${clp(dif)}` : `Faltan ${clp(Math.abs(dif))}`
                return (
                  <div key={c.tipo} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-ink capitalize">{c.tipo}</p>
                      <p className="text-[11px] text-muted">
                        Esperado {clp(c.efectivo_esperado)} · Contado {clp(c.efectivo_contado)}
                      </p>
                    </div>
                    <span className={`text-[13px] font-bold ${color}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Proveedores del día */}
        {todosProveedores.length > 0 && (
          <div className="card">
            <p className="eyebrow mb-3">Proveedores del día</p>
            <div className="space-y-2.5">
              {todosProveedores.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="flex-1 text-[13px] text-ink truncate">{p.nombre}</span>
                  <span
                    className="text-[10px] font-bold rounded-full px-2.5 py-0.5 capitalize"
                    style={{ background: `${FORM_COLORS[p.forma_pago] || '#5C3317'}15`, color: FORM_COLORS[p.forma_pago] || '#5C3317' }}
                  >
                    {p.forma_pago}
                  </span>
                  <span className="text-[13px] font-bold text-ink tabular-nums min-w-[90px] text-right">
                    {clp(p.monto)}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2.5 pt-3 border-t border-soft mt-1">
                <span className="flex-1 text-[14px] font-bold text-ink">Total</span>
                <Amount variant="card" color="brand" value={totalProveedores} />
              </div>
            </div>
          </div>
        )}

      </div>

      <ConfirmDialog
        open={showDesmarcarConfirm}
        title="¿Desmarcar turno único?"
        description="El turno de tarde volverá a mostrarse de forma separada."
        confirmLabel="Desmarcar"
        onCancel={() => setShowDesmarcarConfirm(false)}
        onConfirm={() => { setShowDesmarcarConfirm(false); toggleTurnoUnico() }}
      />

      <ConfirmDialog
        open={showMergeConfirm}
        title="¿Fusionar como turno único?"
        description="El turno de tarde quedará oculto y el día se tratará como jornada completa de mañana. Puedes desmarcar esto en cualquier momento."
        confirmLabel="Fusionar"
        onCancel={() => setShowMergeConfirm(false)}
        onConfirm={() => { setShowMergeConfirm(false); toggleTurnoUnico() }}
      />

      {showSelectorCorreccion && (
        <>
          <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={() => setShowSelectorCorreccion(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <p className="font-bold text-ink text-base">¿Qué turno quieres revisar?</p>
              <div className="flex flex-col gap-2">
                {turnosCorregidos.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setShowSelectorCorreccion(false); setTurnoCorreccion(t) }}
                    className="capitalize rounded-xl py-2.5 px-3 text-[13px] font-semibold bg-brand-tint text-brand border border-brand/30"
                  >
                    {t.tipo}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSelectorCorreccion(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </>
      )}

      {turnoCorreccion && (
        <CorreccionModal turno={turnoCorreccion} onClose={() => setTurnoCorreccion(null)} />
      )}
    </Layout>
  )
}
