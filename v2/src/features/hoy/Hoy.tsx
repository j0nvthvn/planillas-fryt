import { Link, useNavigate } from '@tanstack/react-router'
import Icon from '@/components/Icon'
import { EsqueletoContenido } from '@/components/Esqueleto'
import { useUsuario } from '@/hooks/useUsuario'
import { useResumenDia, useTurnosDia, useBorradores, etiquetaModo, type Modo } from '@/features/turno/api'
import { useConfig, useMetodos } from '@/features/catalogo/api'
import { fechaLegible, mayusculaInicial, fechaDiaMes, hoy, clp, clpSigno, diaSemana, sumarDias, horaCorta } from '@/lib/format'
import { AvatarMenu } from '@/components/AvatarMenu'
import { colorMetodo } from '@/lib/theme'

export default function Hoy() {
  const fecha = hoy()
  const ayer = sumarDias(fecha, -1)
  const navigate = useNavigate()
  const { esDueno } = useUsuario()
  const { config } = useConfig()
  const resumen = useResumenDia(fecha)
  const resumenAyer = useResumenDia(ayer)
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
  const ultimo = lista.reduce<string | null>((m, t) => (t.turno.updated_at && (!m || t.turno.updated_at > m) ? t.turno.updated_at : m), null)

  let cta: { label: string; modo: Modo } | null
  if (borradorHoy) cta = { label: borradorHoy.turno.modo === 'completo' ? 'Terminar de cerrar el día' : `Terminar de cerrar la ${borradorHoy.turno.modo}`, modo: borradorHoy.turno.modo }
  else if (!lista.length) cta = { label: 'Cerrar el día', modo: 'completo' }
  else if (hayManana && !hayTarde && !esCompleto && !diaUnico) cta = { label: 'Cerrar turno tarde', modo: 'tarde' }
  else cta = null

  const borradoresViejos = (borradores.data ?? []).filter((b) => b.fecha !== fecha)
  const totalVentas = Number(r?.total_ventas ?? 0)
  const porMetodo = (metodos.data ?? [])
    .map((m) => ({ ...m, monto: Number((r as unknown as Record<string, unknown>)?.[m.key] ?? 0) }))
    .filter((m) => m.monto > 0)
    .sort((a, b) => b.monto - a.monto)
  const neto = Number(r?.neto ?? 0)
  const ra = resumenAyer.data
  const descuadres = lista.filter(({ turno }) => turno.diferencia_efectivo != null && Number(turno.diferencia_efectivo) !== 0)

  return (
    <div className="max-w-2xl mx-auto">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="eyebrow text-brand">Hoy</p>
          <p className="text-base font-medium text-ink leading-tight">{fechaLegible(fecha)}</p>
        </div>
        <AvatarMenu />
      </header>

      {borradoresViejos.length > 0 && (
        <div role="alert" className="mb-4 rounded-2xl bg-warn-tint border border-warn/30 px-4 py-3 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-warn/15 grid place-items-center shrink-0 mt-0.5"><Icon name="warning" className="w-4 h-4 text-warn" stroke={2} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warn">{borradoresViejos.length === 1 ? 'Hay un turno sin cerrar' : `Hay ${borradoresViejos.length} turnos sin cerrar`}</p>
            <ul className="mt-1 space-y-1">
              {borradoresViejos.slice(0, 5).map((b) => (
                <li key={b.id}>
                  <Link to="/turno" search={{ fecha: b.fecha, modo: b.modo }} className="inline-block py-1 text-xs font-bold text-warn underline underline-offset-2">
                    {mayusculaInicial(`${fechaDiaMes(b.fecha)} · ${etiquetaModo(b.modo).toLowerCase()}`)} → cerrar
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {resumen.isPending && turnos.isPending ? <EsqueletoContenido sinTitulo /> : (
        <>
          {/* La cifra al frente */}
          <section aria-label="Neto del día" className="mb-5">
            <p className="eyebrow">Neto del día</p>
            <p className={`amount text-hero leading-[0.95] mt-1 ${neto >= 0 ? 'text-pos' : 'text-neg'}`}>{clp(neto)}</p>
            <p className="text-xs text-muted mt-2">{clp(totalVentas)} ventas − {clp(r?.total_proveedores ?? 0)} proveedores</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <EstadoChip estado={r?.estado ?? 'sin_registro'} />
              {borradorHoy && <span className="text-xs text-muted">{borradorHoy.turno.trabajador_nombre ?? borradorHoy.turno.usuario_nombre ?? ''}{ultimo ? ` · última anotación ${horaCorta(ultimo)}` : ''}</span>}
              {!borradorHoy && lista.length > 0 && <span className="text-xs text-muted">{lista.map((t) => t.turno.trabajador_nombre ?? t.turno.usuario_nombre).filter(Boolean).join(' y ')}</span>}
            </div>
          </section>

          {cta ? (
            <button type="button" onClick={() => void navigate({ to: '/turno', search: { fecha, modo: cta.modo } })} className="btn-primary w-full min-h-[56px] text-lg rounded-[18px] mb-4">
              <Icon name={borradorHoy ? 'check' : 'plus'} className="w-5 h-5" stroke={2.4} />{cta.label}
            </button>
          ) : (
            <div className="mb-4 rounded-2xl bg-pos-tint border border-pos-border px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-pos">Día completo registrado</p>
              {esDueno && <Link to="/dia" search={{ fecha }} className="text-xs font-bold text-pos underline underline-offset-2">Ver planilla</Link>}
            </div>
          )}

          <section className="card mb-4" aria-label="Efectivo esperado en caja">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-ink text-base">Efectivo esperado</p>
              <span className="amount text-amount-sm text-brand">{clp(r?.efectivo_esperado ?? 0)}</span>
            </div>
            <p className="text-xs text-muted mt-0.5">fondo + efectivo − proveedores en efectivo</p>
            {r?.con_conteo && (
              <p className={`text-xs font-semibold mt-2 ${r.con_descuadre ? 'text-neg' : 'text-pos'}`}>
                {r.con_descuadre ? `Descuadre al contar: ${descuadres.map(({ turno }) => clpSigno(Number(turno.diferencia_efectivo))).join(' · ')}` : 'La caja cuadró al contar'}
              </p>
            )}
            {porMetodo.length > 0 && (
              <div className="mt-4 space-y-2">
                {porMetodo.map((m) => {
                  const pct = totalVentas ? Math.max(3, (m.monto / totalVentas) * 100) : 0
                  return (
                    <div key={m.key} className="flex items-center gap-2.5 text-sm">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorMetodo(m.color) }} />
                      <span className="w-[104px] shrink-0 text-ink2 truncate">{m.label}</span>
                      <span className="flex-1 h-1.5 rounded-full bg-soft overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: colorMetodo(m.color) }} /></span>
                      <span className="font-bold text-ink tabular-nums w-[84px] text-right">{clp(m.monto)}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {porMetodo.length === 0 && <p className="text-sm text-muted text-center py-3">Sin ventas registradas todavía</p>}
          </section>

          {lista.length > 1 && (
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {lista.map(({ turno }) => (
                <Link key={turno.id} to="/dia" search={{ fecha }} className="card p-4 flex flex-col gap-1 hover:border-brand/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{etiquetaModo(turno.modo)}</span>
                    {turno.is_draft ? <span className="text-xs font-bold uppercase text-warn">borrador</span> : <Icon name="check" className="w-4 h-4 text-pos" stroke={2.4} />}
                  </div>
                  <span className="cifra text-xl text-ink">{clp(turno.total_ventas)}</span>
                  <span className="text-xs text-muted truncate">{turno.trabajador_nombre ?? turno.usuario_nombre ?? '—'}</span>
                </Link>
              ))}
            </div>
          )}

          {ra && (ra.turnos ?? 0) > 0 && (
            <Link to="/dia" search={{ fecha: ayer }} className="block text-center text-xs text-muted hover:text-ink mt-1 py-2">
              Ayer: <b className="text-ink tabular-nums">{clp(ra.neto)}</b> neto · {ra.con_conteo ? (ra.con_descuadre ? 'hubo descuadre' : 'cuadró la caja') : 'sin conteo'}
            </Link>
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
  return <span className={`whitespace-nowrap text-xs font-bold uppercase tracking-wide rounded-full px-2.5 py-1 ${e.cls}`}>{e.label}</span>
}
