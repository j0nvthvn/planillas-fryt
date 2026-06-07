import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import Resumen from './Resumen'
import { fechaLegible, clp, hoy } from '../utils/format'
import { totalesVentas } from '../utils/totales'
import Icon from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'

export default function Historial() {
  const { esDueno } = useAuth()
  const { esDiaUnico } = useConfig()
  const navigate = useNavigate()
  const [jornadas, setJornadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)
  const [fechaPicker, setFechaPicker] = useState('')

  useEffect(() => {
    if (fechaSeleccionada === null) cargarJornadas()
  }, [fechaSeleccionada])

  async function cargarJornadas() {
    const { data } = await supabase
      .from('jornadas')
      .select(`id, fecha, es_turno_unico, turnos(id, tipo, ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia))`)
      .order('fecha', { ascending: false })
      .limit(90)
    setJornadas(data || [])
    setCargando(false)
  }

  const fechaPickerEnHistorial = jornadas.find((j) => j.fecha === fechaPicker)

  if (fechaSeleccionada) {
    return (
      <Resumen
        fecha={fechaSeleccionada}
        esDuenoOverride={esDueno}
        onBack={() => setFechaSeleccionada(null)}
      />
    )
  }

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-zinc-100">Historial de jornadas</h1>

        {/* Registrar turno anterior */}
        {esDueno && (
          <div className="card space-y-3 max-w-md">
            <div>
              <label className="label">Registrar turno anterior</label>
              <input type="date" value={fechaPicker} max={hoy()}
                onChange={(e) => setFechaPicker(e.target.value)}
                className="input" />
            </div>
            {fechaPicker && (
              fechaPickerEnHistorial ? (
                <button onClick={() => setFechaSeleccionada(fechaPicker)}
                  className="btn-secondary w-full flex items-center justify-center gap-2">
                  <Icon name="arrowLeft" className="w-4 h-4 rotate-180" />
                  Ver jornada del {new Date(fechaPicker + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}
                </button>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 dark:text-zinc-500">¿Qué turno quieres registrar?</p>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/turno/editar?fecha=${fechaPicker}&tipo=mañana`)}
                      className="flex-1 btn-secondary flex items-center justify-center gap-2 py-3">
                      <Icon name="sun" className="w-4 h-4" /> Mañana
                    </button>
                    <button onClick={() => navigate(`/turno/editar?fecha=${fechaPicker}&tipo=tarde`)}
                      className="flex-1 btn-secondary flex items-center justify-center gap-2 py-3">
                      <Icon name="moon" className="w-4 h-4" /> Tarde
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {jornadas.length === 0 && (
          <div className="card text-center text-gray-400 dark:text-zinc-500 py-12">No hay jornadas registradas.</div>
        )}

        <div className="grid lg:grid-cols-2 gap-2">
          {jornadas.map((j) => {
            const turnos = j.turnos || []
            const totalVentas = turnos.reduce((sum, t) => sum + totalesVentas(t.ventas).total, 0)
            return (
              <div key={j.id} onClick={() => setFechaSeleccionada(j.fecha)}
                role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFechaSeleccionada(j.fecha)}
                className="w-full card text-left hover:border-[#5C3317]/30 dark:hover:border-brand/40 hover:shadow-md transition-all flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-gray-800 dark:text-zinc-200 capitalize">{fechaLegible(j.fecha)}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {((esDiaUnico(j.fecha) || j.es_turno_unico) ? ['mañana'] : ['mañana', 'tarde']).map((t) => {
                      const presente = turnos.find((tu) => tu.tipo === t)
                      if (presente) {
                        return (
                          <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#E6F1EA] dark:bg-emerald-950/40 text-[#1E7A4F] dark:text-emerald-400">
                            <Icon name={t === 'mañana' ? 'sun' : 'moon'} className="w-3.5 h-3.5" />
                            {t}
                          </span>
                        )
                      }
                      if (esDueno) {
                        return (
                          <button key={t}
                            onClick={(e) => { e.stopPropagation(); navigate(`/turno/editar?fecha=${j.fecha}&tipo=${t}`) }}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors">
                            <Icon name="plus" className="w-3 h-3" />
                            {t}
                          </button>
                        )
                      }
                      return (
                        <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-zinc-500">
                          <Icon name={t === 'mañana' ? 'sun' : 'moon'} className="w-3.5 h-3.5" />
                          {t}
                        </span>
                      )
                    })}
                    {j.es_turno_unico && (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
                        Único
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-brand dark:text-[#E8C9A8]">{clp(totalVentas)}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">ventas totales</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
