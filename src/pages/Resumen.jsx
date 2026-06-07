import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import { clp, fechaLegible, hoy } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'
import Icon from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { useJornadaRealtime } from '../hooks/useJornadaRealtime'
import { MetodoLogo, METODOS_VENTA } from '../components/TurnoInput'

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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {onBack && (
          <button onClick={onBack} className="btn-secondary flex items-center gap-2">
            <Icon name="arrowLeft" className="w-4 h-4" />
            Volver al historial
          </button>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 capitalize">{fechaLegible(fecha)}</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Resumen del día</h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={irAnterior}
              className="w-9 h-9 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors">
              <Icon name="chevL" className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => dateInputRef.current?.showPicker()}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors"
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
              className="w-9 h-9 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors disabled:opacity-30 disabled:pointer-events-none">
              <Icon name="chevR" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {turnos.length === 0 && (
          <div className="card text-center text-gray-400 dark:text-zinc-500 py-12">
            No hay turnos registrados para este día.
          </div>
        )}

        {/* Chips estado turnos */}
        <div className="flex gap-2 items-start">
          {/* Chip Mañana */}
          {(() => {
            const presente = turnos.find((tu) => tu.tipo === 'mañana')
            return (
              <div className="flex-1 flex flex-col gap-1.5">
                <div className={`rounded-xl p-3 text-center border ${
                  presente
                    ? 'bg-[#E6F1EA] dark:bg-emerald-950/40 border-[#1E7A4F] dark:border-emerald-700 text-[#1E7A4F] dark:text-emerald-400'
                    : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500'
                }`}>
                  <Icon name="sun" className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium capitalize">mañana</div>
                  <div className="text-xs flex items-center justify-center gap-1">
                    {presente && <Icon name="check" className="w-3 h-3" stroke={2.4} />}
                    {presente ? presente.usuario?.nombre : 'Sin registrar'}
                  </div>
                </div>
                {puedeEditar && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => navigate(`/turno/editar?fecha=${fecha}&tipo=mañana`)}
                      className={`flex-1 rounded-xl py-1.5 text-xs font-semibold flex items-center justify-center gap-1 border transition
                        ${presente
                          ? 'border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                          : 'border-[#5C3317]/30 dark:border-emerald-700/30 text-[#5C3317] dark:text-[#E8C9A8] bg-[#F5EAD4] dark:bg-[#3d2817] hover:bg-[#EDD9BA] dark:hover:bg-[#4a3020]'}`}>
                      <Icon name={presente ? 'edit' : 'plus'} className="w-3.5 h-3.5" />
                      {presente ? 'Editar' : 'Agregar'}
                    </button>
                    {jornadaEsUnica && !esDiaUnico(fecha) && (
                      <button onClick={() => setShowDesmarcarConfirm(true)}
                        className="rounded-xl py-1.5 px-2.5 text-xs font-semibold flex items-center gap-1 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition">
                        Desmarcar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Chip Tarde — se oculta cuando es turno único */}
          {!esTurnoUnico && (() => {
            const presente = turnos.find((tu) => tu.tipo === 'tarde')
            return (
              <div className="flex-1 flex flex-col gap-1.5">
                <div className={`rounded-xl p-3 text-center border ${
                  presente
                    ? 'bg-[#E6F1EA] dark:bg-emerald-950/40 border-[#1E7A4F] dark:border-emerald-700 text-[#1E7A4F] dark:text-emerald-400'
                    : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500'
                }`}>
                  <Icon name="moon" className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium capitalize">tarde</div>
                  <div className="text-xs flex items-center justify-center gap-1">
                    {presente && <Icon name="check" className="w-3 h-3" stroke={2.4} />}
                    {presente ? presente.usuario?.nombre : 'Sin registrar'}
                  </div>
                </div>
                {puedeEditar && (
                  <button
                    onClick={() => navigate(`/turno/editar?fecha=${fecha}&tipo=tarde`)}
                    className={`w-full rounded-xl py-1.5 text-xs font-semibold flex items-center justify-center gap-1 border transition
                      ${presente
                        ? 'border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                        : 'border-[#5C3317]/30 dark:border-emerald-700/30 text-[#5C3317] dark:text-[#E8C9A8] bg-[#F5EAD4] dark:bg-[#3d2817] hover:bg-[#EDD9BA] dark:hover:bg-[#4a3020]'}`}>
                    <Icon name={presente ? 'edit' : 'plus'} className="w-3.5 h-3.5" />
                    {presente ? 'Editar' : 'Agregar'}
                  </button>
                )}
              </div>
            )
          })()}
        </div>

        {/* Fusionar en turno único — acción con etiqueta, solo cuando aplica */}
        {puedeEditar && !esDiaUnico(fecha) && !esTurnoUnico && datos.jornada && turnoMañana && !turnoTarde && (
          <button
            onClick={() => setShowMergeConfirm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:border-[#5C3317]/40 hover:text-[#5C3317] dark:hover:text-[#E8C9A8] transition-colors">
            <Icon name="merge" className="w-4 h-4" stroke={1.8} />
            Fusionar en turno único
          </button>
        )}

        {/* Ventas comparativo */}
        {turnos.length > 0 && (
          <div className="card">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Ventas por método de pago</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 dark:text-zinc-400 border-b dark:border-zinc-700">
                    <th className="text-left py-2 font-medium">Método</th>
                    <th className="text-right py-2 font-medium">
                      <span className="hidden sm:inline">Mañana</span>
                      <span className="sm:hidden">Mañ.</span>
                    </th>
                    <th className="text-right py-2 font-medium">
                      <span className="hidden sm:inline">Tarde</span>
                      <span className="sm:hidden">Tar.</span>
                    </th>
                    <th className="text-right py-2 font-medium text-gray-700 dark:text-zinc-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {METODOS_VENTA.filter((m) => (vm[m.key] || 0) + (vt[m.key] || 0) > 0).map((m) => (
                    <tr key={m.key}>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <MetodoLogo metodo={m} size="sm" />
                          <span className="text-gray-700 dark:text-zinc-300 leading-tight">{m.label}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-zinc-300 whitespace-nowrap tabular-nums">{clp(vm[m.key] || 0)}</td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-zinc-300 whitespace-nowrap tabular-nums">{clp(vt[m.key] || 0)}</td>
                      <td className="py-1.5 text-right font-semibold whitespace-nowrap tabular-nums">{clp((vm[m.key] || 0) + (vt[m.key] || 0))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 dark:border-zinc-700">
                    <td className="py-2 font-bold text-sm">Total ventas</td>
                    <td className="py-2 text-right font-bold tabular-nums text-[#5C3317] dark:text-[#E8C9A8] whitespace-nowrap">{clp(vm.total)}</td>
                    <td className="py-2 text-right font-bold tabular-nums text-[#5C3317] dark:text-[#E8C9A8] whitespace-nowrap">{clp(vt.total)}</td>
                    <td className="py-2 text-right font-bold tabular-nums text-[#5C3317] dark:text-[#E8C9A8] text-sm whitespace-nowrap">{clp(totalVentas)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Balance del día */}
        {turnos.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Balance del día</p>
              <div className="flex items-center gap-2">
                {!ambosPresentes && !esTurnoUnico && (
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-full px-2 py-0.5">
                    Parcial
                  </span>
                )}
                {jornadaEsUnica && (
                  <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700 rounded-full px-2 py-0.5">
                    Turno único
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mb-0.5">Neto total</p>
              <p className="text-2xl font-black tabular-nums leading-tight"
                style={{ color: ventasNetas >= 0 ? '#1E7A4F' : '#b91c1c' }}>
                {clp(ventasNetas)}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
                {clp(totalVentas)} ventas − {clp(totalProveedores)} proveedores
              </p>
            </div>
          </div>
        )}

        {/* Tabla de proveedores consolidada */}
        {todosProveedores.length > 0 && (
          <div className="card">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Proveedores del día</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 dark:text-zinc-400 border-b dark:border-zinc-700">
                    <th className="text-left py-2 font-medium">Proveedor</th>
                    <th className="text-right py-2 font-medium">Monto</th>
                    <th className="text-right py-2 font-medium">Pago</th>
                    <th className="text-right py-2 font-medium">Turno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {todosProveedores.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2">{p.nombre}</td>
                      <td className="py-2 text-right font-medium">{clp(p.monto)}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          p.forma_pago === 'efectivo'
                            ? 'bg-[#E6F1EA] dark:bg-emerald-950/40 text-[#1E7A4F] dark:text-emerald-400'
                            : 'bg-[#E8EDF6] dark:bg-blue-950/40 text-[#33518C] dark:text-blue-300'
                        }`}>
                          {p.forma_pago}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-500 dark:text-zinc-400 text-xs">{p.turno}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 dark:border-zinc-700">
                  <tr>
                    <td className="py-2 font-bold text-sm">Totales</td>
                    <td className="py-2 text-right font-bold">{clp(pm.efectivo + pt.efectivo + pm.transferencia + pt.transferencia)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmación desmarcar */}
      {showDesmarcarConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowDesmarcarConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">¿Desmarcar turno único?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
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

      {/* Modal confirmación fusionar */}
      {showMergeConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowMergeConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">¿Fusionar como turno único?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
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
