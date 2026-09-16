import { Link, useNavigate } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Amount from '@/components/Amount'
import Icon from '@/components/Icon'
import Spinner from '@/components/Spinner'
import { useUsuario } from '@/hooks/useUsuario'
import { useResumenDia, useTurnosDia, useBorradores, etiquetaModo, type Modo } from '@/features/turno/api'
import { useConfig, useMetodos } from '@/features/catalogo/api'
import { fechaLegible, fechaDiaMes, hoy, clp, clpSigno, diaSemana } from '@/lib/format'
import { cerrarSesion } from '@/lib/auth'

export default function Hoy() {
  const fecha = hoy()
  const navigate = useNavigate()
  const { esDueno, usuario } = useUsuario()
  const { config } = useConfig()
  const resumen = useResumenDia(fecha)
  const turnos = useTurnosDia(fecha)
  const borradores = useBorradores()
  const metodos = useMetodos()

  const r = resumen.data
  const lista = turnos.data ?? []
  const diaUnico = config.diasTurnoUnico.includes(diaSemana(fecha))
  const hayManana = lista.some((t) => t.turno.tipo === 'mañana')
  const hayTarde = lista.some((t) => t.turno.tipo === 'tarde')
  const esCompleto = lista.some((t) => t.turno.modo === 'completo')
  const borradorHoy = lista.find((t) => t.turno.is_draft)

  // Qué acción principal ofrecer según el estado del día.
  let cta: { label: string; modo: Modo; icon: 'plus' | 'check' } | null
  if (borradorHoy) cta = { label: `Terminar de cerrar (${etiquetaModo(borradorHoy.turno.modo).toLowerCase()})`, modo: borradorHoy.turno.modo, icon: 'check' }
  else if (!lista.length) cta = { label: diaUnico ? 'Cerrar el día' : 'Cerrar el día', modo: 'completo', icon: 'plus' }
  else if (hayManana && !hayTarde && !esCompleto && !diaUnico) cta = { label: 'Cerrar turno tarde', modo: 'tarde', icon: 'plus' }
  else cta = null

  const borradoresViejos = (borradores.data ?? []).filter((b) => b.fecha !== fecha)
  const porMetodo = (metodos.data ?? [])
    .map((m) => ({ ...m, monto: Number((r as unknown as Record<string, unknown>)?.[m.key] ?? 0) }))
    .filter((m) => m.monto > 0)
    .sort((a, b) => b.monto - a.monto)

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader eyebrow="FrytControl" title="Hoy" subtitle={fechaLegible(fecha)}
        action={
          <button type="button" onClick={() => void cerrarSesion()} className="w-[42px] h-[42px] rounded-full bg-brand text-white font-bold grid place-items-center"
            aria-label={`Cerrar sesión de ${usuario?.nombre ?? ''}`} title="Cerrar sesión">
            {(usuario?.nombre?.[0] ?? '?').toUpperCase()}
          </button>
        }
      />

      {borradoresViejos.length > 0 && (
        <div role="alert" className="mb-3.5 rounded-2xl bg-warn-tint border border-warn/30 px-4 py-3 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-warn/15 grid place-items-center shrink-0 mt-0.5"><Icon name="warning" className="w-4 h-4 text-warn" stroke={2} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-warn">{borradoresViejos.length === 1 ? 'Hay un turno sin cerrar' : `Hay ${borradoresViejos.length} turnos sin cerrar`}</p>
            <ul className="mt-1 space-y-1">
              {borradoresViejos.slice(0, 5).map((b) => (
                <li key={b.id}>
                  <Link to="/turno" search={{ fecha: b.fecha, modo: b.modo }} className="text-[12.5px] font-bold text-warn underline underline-offset-2 capitalize">
                    {fechaDiaMes(b.fecha)} · {etiquetaModo(b.modo)} → cerrar
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {resumen.isPending && turnos.isPending ? <Spinner /> : (
        <>
          <div className="card-hero mb-3.5">
            <div className="flex items-baseline justify-between mb-1">
              <p className="eyebrow">Neto del día</p>
              <EstadoChip estado={r?.estado ?? 'sin_registro'} />
            </div>
            <Amount variant="hero" color={(r?.neto ?? 0) >= 0 ? 'pos' : 'neg'} value={r?.neto ?? 0} />
            <p className="text-[12px] text-muted mt-2">{clp(r?.total_ventas ?? 0)} ventas − {clp(r?.total_proveedores ?? 0)} proveedores</p>
          </div>

          {lista.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 mb-3.5">
              {lista.map(({ turno }) => (
                <Link key={turno.id} to="/dia" search={{ fecha }} className="card p-4 flex flex-col gap-1 hover:border-brand/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">{etiquetaModo(turno.modo)}</span>
                    {turno.is_draft ? <span className="text-[10px] font-bold uppercase text-warn">borrador</span> : <Icon name="check" className="w-4 h-4 text-pos" stroke={2.4} />}
                  </div>
                  <span className="amount text-xl text-ink">{clp(turno.total_ventas)}</span>
                  <span className="text-[11.5px] text-muted truncate">{turno.trabajador_nombre ?? turno.usuario_nombre ?? '—'}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="card mb-3.5">
            <div className="flex items-baseline justify-between mb-1">
              <p className="font-semibold text-ink text-[15px]">Efectivo esperado en caja</p>
              <Amount variant="card" color="brand" value={r?.efectivo_esperado ?? 0} />
            </div>
            <p className="text-[12px] text-muted mb-3">fondo + ventas en efectivo − proveedores en efectivo</p>
            {r?.con_conteo && (
              <p className={`text-[12.5px] font-semibold mb-3 ${r.con_descuadre ? 'text-neg' : 'text-pos'}`}>
                {r.con_descuadre ? 'Hubo descuadre al contar la caja' : 'La caja cuadró al contar'}
              </p>
            )}
            {porMetodo.length === 0 ? (
              <p className="text-sm text-muted text-center py-3">Sin ventas registradas todavía</p>
            ) : (
              <div className="space-y-2.5">
                <p className="eyebrow">Ventas por método</p>
                {porMetodo.map((m) => (
                  <div key={m.key} className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="flex-1 text-[13px] text-ink2">{m.label}</span>
                    <span className="text-[13px] font-bold text-ink tabular-nums">{clp(m.monto)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cta ? (
            <button type="button" onClick={() => void navigate({ to: '/turno', search: { fecha, modo: cta.modo } })} className="btn-primary w-full py-3.5 text-base">
              <Icon name={cta.icon} className="w-5 h-5" stroke={2.2} />{cta.label}
            </button>
          ) : (
            <div className="rounded-2xl bg-pos-tint border border-pos-border px-4 py-3 text-center">
              <p className="text-[14px] font-semibold text-pos">Día completo registrado</p>
              {esDueno && <Link to="/dia" search={{ fecha }} className="text-[12.5px] font-bold text-pos underline underline-offset-2">Ver o corregir la planilla</Link>}
            </div>
          )}

          {lista.some(({ turno }) => turno.diferencia_efectivo != null && turno.diferencia_efectivo !== 0) && (
            <p className="text-center text-[12px] text-muted mt-3">
              Descuadre registrado: {lista.filter(({ turno }) => turno.diferencia_efectivo).map(({ turno }) => `${etiquetaModo(turno.modo)} ${clpSigno(Number(turno.diferencia_efectivo))}`).join(' · ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export function EstadoChip({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sin_registro: { label: 'Sin registro', cls: 'bg-soft text-muted' },
    borrador: { label: 'Borrador', cls: 'bg-warn-tint text-warn' },
    parcial: { label: 'Falta la tarde', cls: 'bg-info-tint text-info' },
    completo: { label: 'Completo', cls: 'bg-pos-tint text-pos' },
  }
  const e = map[estado] ?? map.sin_registro!
  return <span className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${e.cls}`}>{e.label}</span>
}
