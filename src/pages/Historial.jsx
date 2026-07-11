import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Resumen from './Resumen'
import { fechaLegible, clp, hoy } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'
import Icon from '../components/Icon'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'

function TurnoChip({ tipo, presente, esDueno, fecha, onAdd }) {
  if (presente) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-br from-pos-tint to-pos-tint/40 text-pos border border-pos-border">
        <Icon name={tipo === 'mañana' ? 'sun' : 'moon'} className="w-3 h-3" stroke={2.2} />
        {tipo}
      </span>
    )
  }
  if (esDueno) {
    return (
      <button
        onClick={onAdd}
        className="group inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-br from-warn-tint to-warn-tint/40 text-warn border border-warn/30 hover:border-warn/60 transition-colors"
      >
        <span className="w-3 h-3 grid place-items-center rounded-full bg-warn/15 group-hover:bg-warn/25 transition-colors">
          <Icon name="plus" className="w-2.5 h-2.5" stroke={2.6} />
        </span>
        {tipo}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-canvas text-muted2 border border-dashed border-muted2/40">
      <span className="w-1.5 h-1.5 rounded-full bg-muted2/60" />
      {tipo}
    </span>
  )
}

const MODOS = [
  { v: 'ventas',      l: 'Ventas',      icon: 'summary' },
  { v: 'proveedores', l: 'Proveedores', icon: 'suppliers' },
]

export default function Historial() {
  const { esDueno } = useAuth()
  const { esDiaUnico } = useConfig()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jornadas, setJornadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => searchParams.get('fecha') || null)
  const [modo, setModo] = useState('ventas')
  const [showRegistrarDialog, setShowRegistrarDialog] = useState(false)
  const [fechaARegistrar, setFechaARegistrar] = useState(hoy())

  useEffect(() => {
    if (fechaSeleccionada === null) cargarJornadas()
  }, [fechaSeleccionada])

  function abrirDia(fecha) {
    setFechaSeleccionada(fecha)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('fecha', fecha)
      return next
    }, { replace: true })
  }

  function volverALista() {
    setFechaSeleccionada(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('fecha')
      return next
    }, { replace: true })
  }

  function confirmarRegistrarDia() {
    if (!fechaARegistrar) return
    setShowRegistrarDialog(false)
    navigate(`/turno/editar?fecha=${fechaARegistrar}&tipo=mañana`, { state: { from: 'historial' } })
  }

  async function cargarJornadas() {
    const { data } = await supabase
      .from('jornadas')
      .select(`
        id, fecha, es_turno_unico,
        turnos(
          id, tipo, is_draft,
          ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
          proveedores:proveedores_turno(monto, forma_pago),
          cierres:turno_cierres(es_correccion)
        )
      `)
      .is('turnos.deleted_at', null)
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
        onBack={volverALista}
      />
    )
  }

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  const mostrandoVentas = modo === 'ventas'

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader title="Historial" />

        {/* Registrar un día anterior */}
        {esDueno && (
          <button
            onClick={() => { setFechaARegistrar(hoy()); setShowRegistrarDialog(true) }}
            className="w-full card flex items-center gap-3 text-left hover:border-brand/40 transition-colors"
          >
            <span className="w-9 h-9 rounded-full bg-brand-tint grid place-items-center shrink-0">
              <Icon name="calendar" className="w-4 h-4 text-brand" stroke={1.8} />
            </span>
            <span className="flex-1 text-[14px] font-semibold text-ink">Registrar un día anterior</span>
            <Icon name="chevR" className="w-4 h-4 text-muted2" />
          </button>
        )}

        {/* Toggle de visualización: Ventas / Proveedores */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="eyebrow">Mostrar</p>
          <div
            role="tablist"
            aria-label="Elegir qué total ver en cada jornada"
            className="flex gap-1 p-1 bg-brand-tint rounded-[15px]"
          >
            {MODOS.map((m) => {
              const activo = modo === m.v
              return (
                <button
                  key={m.v}
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setModo(m.v)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[11px] text-[12.5px] font-bold transition-all ${
                    activo
                      ? 'bg-card text-brand shadow-sm'
                      : 'text-muted hover:text-ink2'
                  }`}
                >
                  <Icon name={m.icon} className="w-3.5 h-3.5" stroke={activo ? 2.2 : 1.8} />
                  {m.l}
                </button>
              )
            })}
          </div>
        </div>

        {jornadas.length === 0 && (
          <div className="card text-center text-muted py-12">No hay jornadas registradas.</div>
        )}

        <div className="grid lg:grid-cols-2 gap-2.5">
          {jornadas.map((j) => {
            const turnos = j.turnos || []
            const totalVentas = turnos.reduce((sum, t) => sum + totalesVentas(t.ventas).total, 0)
            const totalProveedores = turnos.reduce((sum, t) => sum + totalesProveedores(t.proveedores).total, 0)
            const esUnico = esDiaUnico(j.fecha) || j.es_turno_unico
            const tipos = esUnico ? ['mañana'] : ['mañana', 'tarde']
            const open = () => abrirDia(j.fecha)

            const valorPrincipal   = mostrandoVentas ? totalVentas      : totalProveedores
            const colorPrincipal   = mostrandoVentas ? 'text-brand'     : 'text-neg'
            const labelPrincipal   = mostrandoVentas ? 'ventas'         : 'proveedores'
            const valorSecundario  = mostrandoVentas ? totalProveedores : totalVentas
            const labelSecundario  = mostrandoVentas ? 'proveedores'    : 'ventas'
            const prefijoSecundario = mostrandoVentas ? '−' : 'de'

            return (
              <div
                key={j.id}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
                className="w-full rounded-3xl bg-card border border-hairline p-4 text-left hover:border-brand/30 hover:shadow-card transition-all flex items-center justify-between cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
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
                          onAdd={(e) => { e.stopPropagation(); navigate(`/turno/editar?fecha=${j.fecha}&tipo=${t}`, { state: { from: 'historial' } }) }}
                        />
                      )
                    })}
                    {j.es_turno_unico && !esDiaUnico(j.fecha) && (
                      <Badge tone="brand" gradient dot>único</Badge>
                    )}
                    {turnos.some((t) => t.is_draft) && (
                      <Badge tone="warn" gradient dot pulse>borrador</Badge>
                    )}
                    {turnos.some((t) => (t.cierres || []).some((c) => c.es_correccion)) && (
                      <Badge tone="info" gradient icon="edit">corregido</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`font-display tabular-nums text-[22px] leading-none ${colorPrincipal}`}>
                    {clp(valorPrincipal)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5 uppercase tracking-widest font-semibold">
                    {labelPrincipal}
                  </p>
                  {valorSecundario > 0 && (
                    <p className="text-[10.5px] text-muted2 mt-1 tabular-nums">
                      {prefijoSecundario} {clp(valorSecundario)} {labelSecundario}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ConfirmDialog
        open={showRegistrarDialog}
        title="Registrar un día anterior"
        description="Elige la fecha del turno que quieres registrar."
        confirmLabel="Continuar"
        confirmDisabled={!fechaARegistrar}
        onCancel={() => setShowRegistrarDialog(false)}
        onConfirm={confirmarRegistrarDia}
      >
        <div>
          <label className="label">Fecha</label>
          <input
            type="date"
            value={fechaARegistrar}
            max={hoy()}
            onChange={(e) => setFechaARegistrar(e.target.value)}
            className="input"
          />
        </div>
      </ConfirmDialog>
    </Layout>
  )
}
