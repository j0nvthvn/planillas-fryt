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
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useJornadaRealtime } from '../hooks/useJornadaRealtime'
import { MetodoLogo, METODOS_VENTA } from '../components/TurnoInput'

const FORM_COLORS = { efectivo: '#1E7A4F', transferencia: '#33518C' }

function TurnoStatusChip({ tipo, presente, usuario }) {
  const icon = tipo === 'mañana' ? 'sun' : 'moon'
  const label = tipo === 'mañana' ? 'Mañana' : 'Tarde'
  if (!presente) {
    return (
      <div className="flex-1 rounded-2xl border border-hairline bg-canvas px-3 py-2.5 flex items-center gap-2.5 opacity-60">
        <Icon name={icon} className="w-4 h-4 text-muted2" stroke={1.6} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-muted">{label}</p>
          <p className="text-[11px] text-muted2 leading-tight">Sin registrar</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex-1 rounded-2xl border border-pos-border bg-pos-tint px-3 py-2.5 flex items-center gap-2.5">
      <Icon name={icon} className="w-4 h-4 text-pos" stroke={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-pos">{label}</p>
        <p className="text-[11px] text-pos/80 truncate leading-tight">{usuario}</p>
      </div>
    </div>
  )
}

export default function Resumen({ fecha: fechaProp, esDuenoOverride, onBack }) {
  const { esDueno } = useAuth()
  const { esDiaUnico } = useConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const puedeEditar = esDuenoOverride ?? esDueno
  const [fecha, setFecha] = useState(() => fechaProp || location.state?.fecha || hoy())
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [jornadaEsUnica, setJornadaEsUnica] = useState(false)
  const [showMergeConfirm, setShowMergeConfirm] = useState(false)
  const [showDesmarcarConfirm, setShowDesmarcarConfirm] = useState(false)
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
        id, tipo, creado_en,
        usuario:usuarios(nombre),
        proveedores:proveedores_turno(nombre, monto, forma_pago),
        ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)
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
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"
          >
            <Icon name="arrowLeft" className="w-4 h-4" stroke={2} />
            Historial
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
          <div className="flex gap-2 flex-wrap">
            {!esTurnoUnico && datos.jornada && turnoMañana && !turnoTarde && (
              <button
                onClick={() => setShowMergeConfirm(true)}
                className="flex items-center gap-2 rounded-xl py-2 px-3 text-[13px] font-semibold border border-hairline text-ink2 bg-card hover:border-brand/40 hover:text-brand transition-colors"
              >
                <Icon name="merge" className="w-4 h-4" stroke={1.8} />
                Fusionar en turno único
              </button>
            )}
            {(!turnoMañana || (jornadaEsUnica && !esDiaUnico(fecha))) && (
              <button
                onClick={() => navigate(`/turno/editar?fecha=${fecha}&tipo=mañana`)}
                className="flex items-center gap-2 rounded-xl py-2 px-3 text-[13px] font-semibold bg-brand-tint text-brand border border-brand/30"
              >
                <Icon name={turnoMañana ? 'edit' : 'plus'} className="w-4 h-4" stroke={1.8} />
                {turnoMañana ? 'Editar mañana' : 'Agregar mañana'}
              </button>
            )}
            {!esTurnoUnico && !turnoTarde && (
              <button
                onClick={() => navigate(`/turno/editar?fecha=${fecha}&tipo=tarde`)}
                className="flex items-center gap-2 rounded-xl py-2 px-3 text-[13px] font-semibold bg-brand-tint text-brand border border-brand/30"
              >
                <Icon name="plus" className="w-4 h-4" stroke={1.8} />
                Agregar tarde
              </button>
            )}
            {jornadaEsUnica && !esDiaUnico(fecha) && (
              <button
                onClick={() => setShowDesmarcarConfirm(true)}
                className="rounded-xl py-2 px-3 text-[13px] font-semibold border border-hairline text-ink2 bg-card hover:border-brand/40 hover:text-brand transition-colors"
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
            <div className="flex items-center justify-between mb-1.5">
              <p className="eyebrow">Balance del día</p>
              <span
                className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-0.5 border ${
                  esCompleto
                    ? 'bg-pos-tint text-pos border-pos-border'
                    : 'bg-warn-tint text-warn border-warn/30'
                }`}
              >
                {estadoLabel}
              </span>
            </div>
            <Amount variant="hero" color={ventasNetas >= 0 ? 'pos' : 'neg'} value={ventasNetas} className="mt-1" />
            <p className="text-[12px] text-muted mt-2">
              {clp(totalVentas)} ventas − {clp(totalProveedores)} proveedores
            </p>
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

      {showDesmarcarConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={() => setShowDesmarcarConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-ink text-base">¿Desmarcar turno único?</p>
                <p className="text-sm text-ink2 mt-1">
                  El turno de tarde volverá a mostrarse de forma separada.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDesmarcarConfirm(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button
                  onClick={() => { setShowDesmarcarConfirm(false); toggleTurnoUnico() }}
                  className="flex-1 btn-primary">
                  Desmarcar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showMergeConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={() => setShowMergeConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-ink text-base">¿Fusionar como turno único?</p>
                <p className="text-sm text-ink2 mt-1">
                  El turno de tarde quedará oculto y el día se tratará como jornada completa de mañana.
                  Puedes desmarcar esto en cualquier momento.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowMergeConfirm(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button
                  onClick={() => { setShowMergeConfirm(false); toggleTurnoUnico() }}
                  className="flex-1 btn-primary">
                  Fusionar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
