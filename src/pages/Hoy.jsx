import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Amount from '../components/Amount'
import Icon from '../components/Icon'
import { supabase } from '../lib/supabase'
import { fechaLegible, hoy } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'
import { METODOS_VENTA } from '../components/TurnoInput'

function TurnoChip({ tipo, usuario, subtotal, presente }) {
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
    <div className="flex-1 rounded-2xl border border-[#b8dcc7] bg-pos-tint px-3 py-2.5 flex items-center gap-2.5">
      <Icon name={icon} className="w-4 h-4 text-pos" stroke={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-pos">{label}</p>
        <p className="text-[11px] text-pos/80 truncate leading-tight">
          {usuario} · <span className="tabular-nums font-semibold">${subtotal.toLocaleString('es-CL')}</span>
        </p>
      </div>
    </div>
  )
}

export default function Hoy() {
  const navigate = useNavigate()
  const [cargando, setCargando] = useState(true)
  const [turnos, setTurnos] = useState([])

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: jornada } = await supabase
        .from('jornadas')
        .select('id')
        .eq('fecha', hoy())
        .maybeSingle()
      if (!jornada || !activo) {
        if (activo) { setTurnos([]); setCargando(false) }
        return
      }
      const { data: turnosData } = await supabase
        .from('turnos')
        .select(`
          id, tipo,
          usuario:usuarios(nombre),
          ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
          proveedores:proveedores_turno(monto, forma_pago)
        `)
        .eq('jornada_id', jornada.id)
        .order('tipo')
      if (!activo) return
      setTurnos(turnosData || [])
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [])

  const totales = useMemo(() => {
    let ventasTotal = 0
    let provTotal = 0
    let efCaja = 0
    const porMetodo = {}
    for (const m of METODOS_VENTA) porMetodo[m.key] = 0
    for (const t of turnos) {
      const vt = totalesVentas(t.ventas)
      const pt = totalesProveedores(t.proveedores)
      ventasTotal += vt.total
      provTotal += pt.total
      efCaja += vt.efectivo - pt.efectivo
      for (const m of METODOS_VENTA) porMetodo[m.key] += vt[m.key] || 0
    }
    const topMetodos = METODOS_VENTA
      .map((m) => ({ ...m, monto: porMetodo[m.key] }))
      .filter((m) => m.monto > 0)
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 3)
    return { ventasTotal, provTotal, neto: ventasTotal - provTotal, efCaja, topMetodos }
  }, [turnos])

  const turnoManana = turnos.find((t) => t.tipo === 'mañana')
  const turnoTarde = turnos.find((t) => t.tipo === 'tarde')

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  return (
    <Layout>
      <PageHeader
        eyebrow="Minimarket Fryt"
        title="Hoy"
        date={fechaLegible(hoy())}
      />

      {/* Card hero: Neto del día */}
      <div className="card-hero mb-3.5">
        <div className="flex items-baseline justify-between mb-1">
          <p className="eyebrow">Neto del día</p>
          <p className="text-[11px] text-muted">ventas − proveedores</p>
        </div>
        <Amount
          variant="hero"
          color={totales.neto >= 0 ? 'pos' : 'neg'}
          value={totales.neto}
          className="mt-1"
        />
        <p className="text-[12px] text-muted mt-2">
          ${totales.ventasTotal.toLocaleString('es-CL')} ventas − ${totales.provTotal.toLocaleString('es-CL')} proveedores
        </p>
      </div>

      {/* Chips mañana/tarde */}
      <div className="flex gap-2.5 mb-3.5">
        <TurnoChip
          tipo="mañana"
          usuario={turnoManana?.usuario?.nombre}
          subtotal={turnoManana ? totalesVentas(turnoManana.ventas).total : 0}
          presente={!!turnoManana}
        />
        <TurnoChip
          tipo="tarde"
          usuario={turnoTarde?.usuario?.nombre}
          subtotal={turnoTarde ? totalesVentas(turnoTarde.ventas).total : 0}
          presente={!!turnoTarde}
        />
      </div>

      {/* Card: Efectivo en caja */}
      <div className="card mb-3.5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="font-semibold text-ink text-[15px]">Efectivo en caja</p>
          <Amount variant="card" color="brand" value={totales.efCaja} />
        </div>
        {totales.topMetodos.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Sin ventas registradas</p>
        ) : (
          <div className="space-y-2.5">
            {totales.topMetodos.map((m) => (
              <div key={m.key} className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="flex-1 text-[13px] text-ink2">{m.label}</span>
                <span className="text-[13px] font-bold text-ink tabular-nums">
                  ${m.monto.toLocaleString('es-CL')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA Ingresar turno */}
      <button
        onClick={() => navigate('/turno')}
        className="btn-primary w-full py-3.5 text-base gap-2"
      >
        <Icon name="plus" className="w-5 h-5" stroke={2.2} />
        Ingresar turno
      </button>
    </Layout>
  )
}
