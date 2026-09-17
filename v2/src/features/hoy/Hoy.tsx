import { useState, type ReactNode } from 'react'
import { AvisoAmbar } from '@/components/Aviso'
import { Link, useNavigate } from '@tanstack/react-router'
import Icon from '@/components/Icon'
import { EsqueletoContenido } from '@/components/Esqueleto'
import { useUsuario } from '@/hooks/useUsuario'
import { useResumenDia, useTurnosDia, useBorradores, etiquetaModo, type Modo } from '@/features/turno/api'
import { useConfig, useMetodos } from '@/features/catalogo/api'
import { fechaSinAnio, mayusculaInicial, fechaDiaMes, hoy, clp, clpSigno, diaSemana, sumarDias, horaCorta } from '@/lib/format'
import { AvatarMenu } from '@/components/AvatarMenu'
import { colorMetodo } from '@/lib/theme'
import { MetodoLogo } from '@/components/MetodoLogo'
import { DeltaBadge } from '@/components/DeltaBadge'

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
  const [verMetodos, setVerMetodos] = useState(false)

  const r = resumen.data
  const lista = turnos.data ?? []
  const diaUnico = config.diasTurnoUnico.includes(diaSemana(fecha))
  const hayManana = lista.some((t) => t.turno.tipo === 'mañana')
  const hayTarde = lista.some((t) => t.turno.tipo === 'tarde')
  const esCompleto = lista.some((t) => t.turno.modo === 'completo')
  const borradorHoy = lista.find((t) => t.turno.is_draft)

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
  const hayAyer = !!ra && (ra.turnos ?? 0) > 0
  const descuadres = lista.filter(({ turno }) => turno.diferencia_efectivo != null && Number(turno.diferencia_efectivo) !== 0)
  // efectivo_esperado = Σ fondo_inicial + Σ efectivo − Σ proveedores en efectivo (v_turnos).
  const efectivoEsperado = Number(r?.efectivo_esperado ?? 0)
  const fondo = efectivoEsperado - Number(r?.efectivo_neto ?? 0)
  const turnosEsperados = diaUnico || esCompleto ? 1 : 2
  const pendiente: Modo | null = diaUnico || esCompleto || !lista.length ? null : !hayManana ? 'mañana' : !hayTarde ? 'tarde' : null
  const metodosVisibles = verMetodos ? porMetodo : porMetodo.slice(0, 3)

  return (
    <div className="max-w-2xl mx-auto">
      <header className="flex items-center justify-between gap-3 mb-[18px]">
        <div className="min-w-0">
          <p className="eyebrow mb-[5px] truncate">{fechaSinAnio(fecha)}</p>
          <h1 className="font-display text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-ink">Hoy</h1>
        </div>
        <AvatarMenu />
      </header>

      {borradoresViejos.length > 0 && (
        <AvisoAmbar className="mb-3" titulo={borradoresViejos.length === 1 ? 'Hay un turno sin cerrar' : `Hay ${borradoresViejos.length} turnos sin cerrar`}>
            <ul className="mt-1 space-y-1">
              {borradoresViejos.slice(0, 5).map((b) => (
                <li key={b.id}>
                  <Link to="/turno" search={{ fecha: b.fecha, modo: b.modo }} className="hit inline-block py-1 text-xs font-semibold text-warn underline underline-offset-2">
                    {mayusculaInicial(`${fechaDiaMes(b.fecha)} · ${etiquetaModo(b.modo).toLowerCase()}`)} <span aria-hidden="true">→</span> cerrar
                  </Link>
                </li>
              ))}
            </ul>
        </AvisoAmbar>
      )}

      {resumen.isPending && turnos.isPending ? <EsqueletoContenido sinTitulo /> : (
        <>
          {/* La cifra al frente */}
          <section aria-labelledby="hoy-neto" className="card pb-4 mb-3">
            <div className="flex items-center justify-between gap-2.5">
              <h2 id="hoy-neto" className="eyebrow">Neto del día</h2>
              <EstadoChip estado={r?.estado ?? 'sin_registro'} />
            </div>
            <p className="amount text-hero leading-[1.05] text-ink mt-2.5">{clp(neto)}</p>
            {hayAyer && (
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <DeltaBadge actual={neto} anterior={Number(ra.neto ?? 0)} fondo />
                <Link to="/dia" search={{ fecha: ayer }} className="hit text-xs text-muted hover:text-ink">
                  vs. ayer <span className="tabular-nums">{clp(ra.neto)}</span> · {ra.con_conteo ? (ra.con_descuadre ? 'hubo descuadre' : 'cuadró la caja') : 'sin conteo'}
                </Link>
              </div>
            )}
            <div className="flex gap-2.5 min-[360px]:gap-3 mt-4 pt-3.5 border-t border-hairline">
              <Dato label="Ventas">{clp(totalVentas)}</Dato>
              <span className="w-px bg-hairline" aria-hidden="true" />
              <Dato label="Proveedores" className={Number(r?.total_proveedores ?? 0) > 0 ? 'text-neg' : 'text-ink'}>{Number(r?.total_proveedores ?? 0) > 0 ? '−' : ''}{clp(r?.total_proveedores ?? 0)}</Dato>
              <span className="w-px bg-hairline" aria-hidden="true" />
              <Dato label="Turnos">{Math.min(lista.length, turnosEsperados)} de {turnosEsperados}</Dato>
            </div>
          </section>

          {cta ? (
            <button type="button" onClick={() => void navigate({ to: '/turno', search: { fecha, modo: cta.modo } })} className="btn-primary w-full min-h-[52px] text-base rounded-[14px] mb-3">
              <Icon name={borradorHoy ? 'check' : cta.modo === 'tarde' ? 'moon' : 'plus'} className="w-[18px] h-[18px]" stroke={2.4} />{cta.label}
            </button>
          ) : (
            <div className="mb-3 rounded-[14px] bg-pos-tint border border-pos-border px-4 py-3 min-h-[52px] flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-pos">Día completo registrado</p>
              {esDueno && <Link to="/dia" search={{ fecha }} className="hit shrink-0 text-xs font-semibold text-pos underline underline-offset-2">Ver planilla</Link>}
            </div>
          )}

          <section className="card p-0 overflow-hidden mb-3" aria-labelledby="hoy-efectivo">
            <div className="px-[18px] pt-4 pb-3.5">
              <div className="flex items-baseline justify-between gap-2.5">
                <h2 id="hoy-efectivo" className="text-md font-medium text-ink2">Efectivo esperado</h2>
                <span className="cifra text-xl text-ink">{clp(efectivoEsperado)}</span>
              </div>
              <p className="text-xs text-muted2 mt-1.5 leading-snug">
                Fondo <span className="tabular-nums">{clp(fondo)}</span> + efectivo <span className="tabular-nums">{clp(r?.efectivo ?? 0)}</span> − proveedores en efectivo <span className="tabular-nums">{clp(r?.prov_efectivo ?? 0)}</span>
              </p>
              {r?.con_conteo && (
                <p className={`text-xs font-semibold mt-2 ${r.con_descuadre ? 'text-neg' : 'text-pos'}`}>
                  {r.con_descuadre ? `Descuadre al contar: ${descuadres.map(({ turno }) => clpSigno(Number(turno.diferencia_efectivo))).join(' · ')}` : 'La caja cuadró al contar'}
                </p>
              )}
              {porMetodo.length > 0 && (
                <div className="flex h-1.5 gap-0.5 mt-3.5 rounded-full overflow-hidden" aria-hidden="true">
                  {porMetodo.map((m) => <span key={m.key} className="rounded-full min-w-[3px]" style={{ flex: `${m.monto} 1 0`, background: colorMetodo(m.color) }} />)}
                </div>
              )}
            </div>
            {metodosVisibles.map((m) => (
              <div key={m.key} className="flex items-center gap-3 px-[18px] py-2.5 min-h-[60px] border-t border-hairline">
                <MetodoLogo metodo={m} />
                <span className="flex-1 min-w-0 text-md font-medium text-ink truncate">{m.label}</span>
                <span className="text-xs text-muted2 tabular-nums">{totalVentas ? Math.round((m.monto / totalVentas) * 100) : 0}%</span>
                <span className="cifra text-base text-ink min-[360px]:min-w-[86px] text-right">{clp(m.monto)}</span>
              </div>
            ))}
            {porMetodo.length > 3 && (
              <button type="button" onClick={() => setVerMetodos((v) => !v)} aria-expanded={verMetodos}
                className="w-full flex items-center justify-center gap-1.5 min-h-[52px] border-t border-hairline text-sm font-semibold text-brand hover:bg-soft">
                {verMetodos ? 'Ver menos' : `Ver los ${porMetodo.length} métodos`}
                <Icon name={verMetodos ? 'caretUp' : 'caretDown'} className="w-3.5 h-3.5" stroke={2.2} />
              </button>
            )}
            {porMetodo.length === 0 && <p className="text-sm text-muted text-center py-4 border-t border-hairline">Sin ventas registradas todavía</p>}
          </section>

          {lista.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {lista.map(({ turno }) => (
                <Link key={turno.id} to="/dia" search={{ fecha }} className={`rounded-[14px] bg-card border border-hairline shadow-card p-3.5 flex flex-col hover:border-hairline-strong transition-colors ${turno.modo === 'completo' ? 'col-span-2' : ''}`}>
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="text-sm font-medium text-ink2">{etiquetaModo(turno.modo)}</span>
                    {turno.is_draft ? <span className="badge bg-warn-tint text-warn">Borrador</span> : <span className="badge bg-pos-tint text-pos">Cerrado</span>}
                  </div>
                  <span className="cifra text-xl leading-none text-ink">{clp(turno.total_ventas)}</span>
                  <span className="text-xs text-muted truncate mt-[5px]">
                    {[turno.trabajador_nombre ?? turno.usuario_nombre, horaCorta(turno.ultimo_cierre_en ?? turno.updated_at)].filter(Boolean).join(' · ') || '—'}
                  </span>
                </Link>
              ))}
              {pendiente && (
                <div className="rounded-[14px] bg-card border border-dashed border-hairline-strong p-3.5 flex flex-col">
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="text-sm font-medium text-ink2">{etiquetaModo(pendiente)}</span>
                    <span className="badge bg-soft text-muted">Pendiente</span>
                  </div>
                  <span className="cifra text-xl leading-none text-muted2">—</span>
                  <span className="text-xs text-muted mt-[5px]">Sin registro</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function Dato({ label, className = 'text-ink', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs leading-none text-muted mb-[5px]">{label}</p>
      <p className={`cifra text-sm min-[360px]:text-base leading-none truncate ${className}`}>{children}</p>
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
  return <span className={`badge ${e.cls}`}>{e.label}</span>
}
