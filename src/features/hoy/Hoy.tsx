import { useState } from 'react'
import { AvisoAmbar } from '@/components/Aviso'
import { Link, useNavigate } from '@tanstack/react-router'
import Icon from '@/components/Icon'
import { EsqueletoContenido } from '@/components/Esqueleto'
import { Dato, EstadoChip } from '@/components/Dato'
import { useUsuario } from '@/hooks/useUsuario'
import { useResumenDia, useTurnosDia, useBorradores, etiquetaModo } from '@/features/turno/api'
import { useQuitarMarcaDia } from '@/features/turno/useQuitarMarcaDia'
import { estadoDia } from './estadoDia'
import { useConfig, useMetodos } from '@/features/catalogo/api'
import { mayusculaInicial, fechaDiaMes, hoy, clp, clpSigno, diaSemana, sumarDias, horaCorta } from '@/lib/format'
import { porMetodo } from '@/lib/metodos'
import { SaludoHeader } from '@/components/SaludoHeader'
import { BarraMetodos } from '@/components/BarraMetodos'
import { MetodoLogo } from '@/components/MetodoLogo'
import { DeltaBadge } from '@/components/DeltaBadge'
import { DiaCerradoSheet } from '@/components/DiaCerradoSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'

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
  const [marcando, setMarcando] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const quitarMarca = useQuitarMarcaDia(fecha)

  const r = resumen.data
  const lista = turnos.data ?? []
  const diaUnico = config.diasTurnoUnico.includes(diaSemana(fecha))
  const noAbrio = r?.cerrado === true
  const { turnosEsperados, pendiente, hayBorrador, cta } = estadoDia({ turnos: lista, noAbrio, diaUnico })

  const borradoresViejos = (borradores.data ?? []).filter((b) => b.fecha !== fecha)
  const totalVentas = Number(r?.total_ventas ?? 0)
  const ventas = porMetodo(r, metodos.data)
  const neto = Number(r?.neto ?? 0)
  const ra = resumenAyer.data
  const hayAyer = !!ra && (ra.turnos ?? 0) > 0
  const metodosVisibles = verMetodos ? ventas : ventas.slice(0, 3)

  return (
    <div className="relative isolate max-w-2xl mx-auto">
      <SaludoHeader fecha={fecha} />

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

      {/* `||`: mientras falte cualquiera de las dos, el esqueleto. Con `&&` la
          pantalla se pintaba a medias, con el día sin sus turnos. */}
      {resumen.isPending || turnos.isPending ? <EsqueletoContenido sinTitulo /> : (
        <>
          {/* La cifra al frente */}
          <section aria-labelledby="hoy-neto" className="card pb-4 mb-3">
            <div className="flex items-center justify-between gap-2.5">
              <h2 id="hoy-neto" className="eyebrow">Neto del día</h2>
              <EstadoChip estado={r?.estado ?? 'sin_registro'} />
            </div>
            <p className="amount text-hero leading-[1.05] text-ink mt-2.5">{noAbrio ? '—' : clp(neto)}</p>
            {hayAyer && !noAbrio && (
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
              <Dato label="Turnos">{noAbrio ? '—' : `${Math.min(lista.length, turnosEsperados)} de ${turnosEsperados}`}</Dato>
            </div>
          </section>

          {noAbrio ? (
            <div className="mb-3 rounded-[14px] bg-soft border border-hairline px-4 py-3 min-h-[52px] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink2">El local no abrió</p>
                {r?.motivo_cierre && <p className="text-xs text-muted truncate">{r.motivo_cierre}</p>}
              </div>
              {esDueno && (
                <button type="button" onClick={() => setQuitando(true)} className="hit shrink-0 text-xs font-semibold text-ink2 underline underline-offset-2">Quitar marca</button>
              )}
            </div>
          ) : cta ? (
            <button type="button" onClick={() => void navigate({ to: '/turno', search: { fecha, modo: cta.modo } })} className="btn-primary w-full min-h-[52px] text-base rounded-[14px] mb-3">
              <Icon name={hayBorrador ? 'check' : cta.modo === 'tarde' ? 'moon' : 'plus'} className="w-[18px] h-[18px]" stroke={2.4} />{cta.label}
            </button>
          ) : (
            <div className="mb-3 rounded-[14px] bg-pos-tint border border-pos-border px-4 py-3 min-h-[52px] flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-pos">Día completo registrado</p>
              {esDueno && <Link to="/dia" search={{ fecha }} className="hit shrink-0 text-xs font-semibold text-pos underline underline-offset-2">Ver planilla</Link>}
            </div>
          )}

          {/* Solo mientras el día esté en blanco: después de registrar algo ya no tiene sentido. */}
          {esDueno && !noAbrio && !lista.length && (
            <button type="button" onClick={() => setMarcando(true)}
              className="hit w-full min-h-[44px] mb-3 -mt-1 text-sm text-muted hover:text-ink2">
              El local no abrió hoy
            </button>
          )}

          {/* El efectivo esperado va en cada turno: el del día suma dos fondos cuando hay mañana y tarde. */}
          {!noAbrio && (
          <section className="card p-0 overflow-hidden mb-3" aria-labelledby="hoy-metodos">
            <div className="px-[18px] pt-4 pb-3.5">
              <div className="flex items-baseline justify-between gap-2.5">
                <h2 id="hoy-metodos" className="text-md font-medium text-ink2">Ventas por método</h2>
                <span className="cifra text-xl text-ink">{clp(totalVentas)}</span>
              </div>
              <BarraMetodos metodos={ventas} className="mt-3.5" />
            </div>
            {metodosVisibles.map((m) => (
              <div key={m.key} className="flex items-center gap-3 px-[18px] py-2.5 min-h-[60px] border-t border-hairline">
                <MetodoLogo metodo={m} />
                <span className="flex-1 min-w-0 text-md font-medium text-ink truncate">{m.label}</span>
                <span className="text-xs text-muted2 tabular-nums">{totalVentas ? Math.round((m.monto / totalVentas) * 100) : 0}%</span>
                <span className="cifra text-base text-ink min-[360px]:min-w-[86px] text-right">{clp(m.monto)}</span>
              </div>
            ))}
            {ventas.length > 3 && (
              <button type="button" onClick={() => setVerMetodos((v) => !v)} aria-expanded={verMetodos}
                className="w-full flex items-center justify-center gap-1.5 min-h-[52px] border-t border-hairline text-sm font-semibold text-brand hover:bg-soft">
                {verMetodos ? 'Ver menos' : `Ver los ${ventas.length} métodos`}
                <Icon name={verMetodos ? 'caretUp' : 'caretDown'} className="w-3.5 h-3.5" stroke={2.2} />
              </button>
            )}
            {ventas.length === 0 && <p className="text-sm text-muted text-center py-4 border-t border-hairline">Sin ventas registradas todavía</p>}
          </section>
          )}

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
                  <CajaTurno ancha={turno.modo === 'completo'} esperado={turno.efectivo_esperado} contado={turno.efectivo_contado} diferencia={turno.diferencia_efectivo} />
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

      {marcando && <DiaCerradoSheet fecha={fecha} onClose={() => setMarcando(false)} />}
      {quitando && (
        <ConfirmDialog
          title="¿Quitar la marca?"
          message="El día vuelve a quedar sin registro y podrás cerrarlo normalmente."
          confirmLabel="Quitar marca" loading={quitarMarca.ocupado}
          onCancel={() => setQuitando(false)}
          onConfirm={() => void quitarMarca.quitar().then((ok) => { if (ok) setQuitando(false) })}
        />
      )}
    </div>
  )
}

/** Lo que debería haber en la caja de ese turno y, si se contó, si cuadró. */
function CajaTurno({ esperado, contado, diferencia, ancha }: { esperado: number | null; contado: number | null; diferencia: number | null; ancha?: boolean }) {
  const dif = Number(diferencia ?? 0)
  const badge = contado == null ? null : dif === 0
    ? <span className="badge-sm bg-pos-tint text-pos">Cuadró</span>
    : <span className="badge-sm bg-neg-tint text-neg tabular-nums">Descuadre {clpSigno(dif)}</span>
  // mt-auto: la línea queda al pie aunque la tarjeta vecina sea más alta.
  // En media tarjeta el badge no cabe al lado del monto y baja a su propia línea.
  return (
    <span className="mt-auto pt-2.5">
      <span className="flex items-center gap-2 pt-2 border-t border-hairline">
        <span className="text-xs text-muted">En caja</span>
        {ancha && badge}
        <span className="cifra text-sm text-ink ml-auto">{esperado == null ? '—' : clp(esperado)}</span>
      </span>
      {!ancha && badge && <span className="flex mt-1.5">{badge}</span>}
    </span>
  )
}
