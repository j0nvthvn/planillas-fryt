import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Amount from '../components/Amount'
import Icon from '../components/Icon'
import IconButton from '../components/IconButton'
import TurnoStatusChip from '../components/TurnoStatusChip'
import InstallBanner from '../components/InstallBanner'
import { supabase } from '../lib/supabase'
import { fechaLegible, hoy } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'
import { METODOS_VENTA } from '../components/TurnoInput'
import { useAuth } from '../hooks/useAuth'

export default function Hoy() {
  const navigate = useNavigate()
  const { esDueno } = useAuth()
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
          id, tipo, is_draft, fondo_inicial, updated_at,
          usuario:usuarios(nombre),
          ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
          proveedores:proveedores_turno(monto, forma_pago)
        `)
        .eq('jornada_id', jornada.id)
        .is('deleted_at', null)
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
      efCaja += (+t.fondo_inicial || 0) + vt.efectivo - pt.efectivo
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

  // Un borrador sin cambios en varias horas probablemente quedó
  // olvidado sin cerrar (se abrió el turno pero nunca se tocó "Listo").
  // Usamos updated_at (última escritura, incluye autoguardados) y no
  // creado_en, para no alertar sobre un turno que se está editando
  // activamente ahora mismo.
  const UMBRAL_HORAS = 4
  const turnosAbandonados = turnos.filter((t) => {
    if (!t.is_draft || !t.updated_at) return false
    const horas = (Date.now() - new Date(t.updated_at).getTime()) / 3_600_000
    return horas >= UMBRAL_HORAS
  })

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  return (
    <Layout>
      <PageHeader
        eyebrow="FrytControl"
        title="Hoy"
        date={fechaLegible(hoy())}
        action={esDueno && (
          <IconButton
            icon="history"
            iconClassName="w-[18px] h-[18px]"
            variant="secondary"
            label="Historial"
            onClick={() => navigate('/historial')}
          />
        )}
      />

      <InstallBanner />

      {/* Alerta: turno abandonado (borrador sin actividad hace horas) */}
      {turnosAbandonados.length > 0 && (
        <div className="mb-3.5 rounded-2xl bg-warn-tint border border-warn/30 px-4 py-3 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-warn/15 grid place-items-center shrink-0 mt-0.5">
            <Icon name="warning" className="w-4 h-4 text-warn" stroke={2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-warn capitalize">
              {turnosAbandonados.length === 1
                ? `Turno de ${turnosAbandonados[0].tipo} sin cerrar`
                : 'Turnos sin cerrar'}
            </p>
            <p className="text-[12px] text-warn/80 mt-0.5">
              {turnosAbandonados.map((t) => t.tipo).join(' y ')} lleva{turnosAbandonados.length === 1 ? '' : 'n'} más de {UMBRAL_HORAS} horas como borrador sin actividad. Revisa si falta cerrarlo.
            </p>
            <button
              onClick={() => navigate('/turno')}
              className="mt-2 text-[12.5px] font-bold text-warn hover:underline underline-offset-2"
            >
              Ir a cerrar turno →
            </button>
          </div>
        </div>
      )}

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
        <TurnoStatusChip
          tipo="mañana"
          usuario={turnoManana?.usuario?.nombre}
          subtotal={turnoManana ? totalesVentas(turnoManana.ventas).total : 0}
          presente={!!turnoManana}
          isDraft={!!turnoManana?.is_draft}
          onClick={() => navigate('/resumen')}
        />
        <TurnoStatusChip
          tipo="tarde"
          usuario={turnoTarde?.usuario?.nombre}
          subtotal={turnoTarde ? totalesVentas(turnoTarde.ventas).total : 0}
          presente={!!turnoTarde}
          isDraft={!!turnoTarde?.is_draft}
          onClick={() => navigate('/resumen')}
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
