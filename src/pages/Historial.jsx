import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Resumen from './Resumen'
import { fechaLegible, clp, hoy } from '../utils/format'
import { totalesVentas } from '../utils/totales'
import Icon from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'

function TurnoChip({ tipo, presente, esDueno, fecha, onAdd }) {
  if (presente) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-pos-tint text-pos border border-pos-border">
        <Icon name={tipo === 'mañana' ? 'sun' : 'moon'} className="w-3 h-3" stroke={1.8} />
        {tipo}
      </span>
    )
  }
  if (esDueno) {
    return (
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-warn-tint text-warn border border-warn/30 hover:opacity-80"
      >
        <Icon name="plus" className="w-3 h-3" stroke={2} />
        {tipo}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-hairline text-muted2">
      <Icon name={tipo === 'mañana' ? 'sun' : 'moon'} className="w-3 h-3" stroke={1.6} />
      {tipo}
    </span>
  )
}

export default function Historial() {
  const { esDueno } = useAuth()
  const { esDiaUnico } = useConfig()
  const navigate = useNavigate()
  const [jornadas, setJornadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)

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
        <PageHeader title="Historial" />

        {/* Registrar un día anterior */}
        {esDueno && (
          <button
            onClick={() => navigate('/turno/editar')}
            className="w-full card flex items-center gap-3 text-left hover:border-brand/40 transition-colors"
          >
            <span className="w-9 h-9 rounded-full bg-brand-tint grid place-items-center shrink-0">
              <Icon name="calendar" className="w-4 h-4 text-brand" stroke={1.8} />
            </span>
            <span className="flex-1 text-[14px] font-semibold text-ink">Registrar un día anterior</span>
            <Icon name="chevR" className="w-4 h-4 text-muted2" />
          </button>
        )}

        {jornadas.length === 0 && (
          <div className="card text-center text-muted py-12">No hay jornadas registradas.</div>
        )}

        <div className="grid lg:grid-cols-2 gap-2.5">
          {jornadas.map((j) => {
            const turnos = j.turnos || []
            const totalVentas = turnos.reduce((sum, t) => sum + totalesVentas(t.ventas).total, 0)
            const esUnico = esDiaUnico(j.fecha) || j.es_turno_unico
            const tipos = esUnico ? ['mañana'] : ['mañana', 'tarde']
            return (
              <button
                key={j.id}
                onClick={() => setFechaSeleccionada(j.fecha)}
                className="w-full rounded-3xl bg-white border border-hairline p-4 text-left hover:border-brand/30 hover:shadow-card transition-all flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink capitalize text-[14px]">{fechaLegible(j.fecha)}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {tipos.map((t) => {
                      const presente = !!turnos.find((tu) => tu.tipo === t)
                      return (
                        <TurnoChip
                          key={t}
                          tipo={t}
                          presente={presente}
                          esDueno={esDueno}
                          fecha={j.fecha}
                          onAdd={(e) => { e.stopPropagation(); navigate(`/turno/editar?fecha=${j.fecha}&tipo=${t}`) }}
                        />
                      )
                    })}
                    {j.es_turno_unico && !esDiaUnico(j.fecha) && (
                      <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-tint text-brand border border-brand/30">
                        único
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-display tabular-nums text-[22px] text-brand leading-none">
                    {clp(totalVentas)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5 uppercase tracking-widest">ventas</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
