import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import Spinner from '@/components/Spinner'
import { BottomSheet } from '@/components/BottomSheet'
import { MetodoLogo } from '@/components/MetodoLogo'
import { useToast } from '@/components/Toast'
import { useOnline } from '@/hooks/useOnline'
import { useUsuario } from '@/hooks/useUsuario'
import { useConfig, useMetodos, useTrabajadores } from '@/features/catalogo/api'
import { MODOS, etiquetaModo, type Modo } from './api'
import { modoPorDefecto, modosDisponibles, etiquetaCerrar, tituloCierre } from './modo'
import { useTurnoForm, type LineaForm } from './useTurnoForm'
import { ProveedorSheet } from './ProveedorSheet'
import { MontoSheet } from './MontoSheet'
import { ConteoSheet } from './ConteoSheet'
import { RevisionSheet } from './RevisionSheet'
import { clp, clpSigno, fechaLegible, hoy, diaSemana, sumarDias, fechaDiaMes } from '@/lib/format'
import { esMetodo, type MetodoKey } from '@/lib/totales'
import { colorMetodo } from '@/lib/theme'

export default function CerrarTurno() {
  const search = useSearch({ from: '/app/turno' })
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnline()
  const { esDueno } = useUsuario()
  const { config } = useConfig()
  const metodos = useMetodos()
  const trabajadores = useTrabajadores()

  const fecha = search.fecha ?? hoy()
  const diaUnicoConfig = config.diasTurnoUnico.includes(diaSemana(fecha))

  // Primero se necesita el día para decidir el modo por defecto.
  const form = useTurnoForm({ fecha, modo: search.modo ?? 'completo', fondoPorDefecto: config.fondoCajaInicial, online })
  const estadoDia = useMemo(() => ({
    turnos: form.dia.map((t) => ({ tipo: t.turno.tipo, modo: t.turno.modo, is_draft: t.turno.is_draft })),
    diaUnicoConfig,
  }), [form.dia, diaUnicoConfig])

  useEffect(() => {
    if (!search.modo && !form.cargandoDia) {
      void navigate({ to: '/turno', search: { fecha, modo: modoPorDefecto(estadoDia) }, replace: true })
    }
  }, [search.modo, form.cargandoDia, estadoDia, fecha, navigate])

  const modo: Modo = search.modo ?? 'completo'
  const disponibles = modosDisponibles(estadoDia)
  const { state, cambiar, totales } = form

  const [sheet, setSheet] = useState<
    | { t: 'prov'; linea: LineaForm | null }
    | { t: 'venta'; key: MetodoKey }
    | { t: 'fondo' }
    | { t: 'conteo' }
    | { t: 'conteoTotal' }
    | { t: 'fecha' }
    | null
  >(null)
  const [revisar, setRevisar] = useState(false)

  // Altura de la barra fija → los toasts se muestran encima.
  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--sticky-bar-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--sticky-bar-h') }
  }, [state.cargado])

  const soloLectura = state.cerrado && !esDueno
  const turnoManana = form.dia.find((t) => t.turno.tipo === 'mañana')?.turno as unknown as Record<string, number | null> | undefined
  const usadosIds = state.proveedores.map((p) => p.proveedor_id).filter((x): x is string => !!x)

  /** El botón de la barra ya no cierra: abre la revisión. */
  function pedirCierre() {
    // Turno ya cerrado sin cambios: no se registra una corrección vacía.
    if (state.cerrado && !state.sucio) {
      toast.show({ message: 'No hay cambios que guardar' })
      void navigate({ to: '/dia', search: { fecha } })
      return
    }
    setSheet(null)
    setRevisar(true)
  }

  async function onCerrar() {
    const r = await form.cerrar()
    setRevisar(false)
    if (r === 'ok') {
      toast.ok(state.cerrado ? 'Corrección guardada' : modo === 'completo' ? 'Día cerrado' : `Turno ${modo} cerrado`)
      void navigate({ to: '/hoy' })
    } else if (r === 'error') {
      toast.error(form.errorAutosave ?? 'No se pudo cerrar. Tus datos quedaron guardados en este dispositivo.')
    }
  }

  if (!search.modo || !state.cargado || metodos.isPending) return <Spinner />

  return (
    <div className="max-w-2xl mx-auto pb-28">
      <PageHeader
        eyebrow={fecha === hoy() ? 'Hoy' : fechaDiaMes(fecha)}
        title={tituloCierre(modo, state.cerrado)}
        action={esDueno && (
          <button type="button" onClick={() => setSheet({ t: 'fecha' })} className="btn-secondary px-3 min-h-[42px]" aria-label="Cambiar fecha">
            <Icon name="calendar" className="w-[18px] h-[18px]" />{fechaDiaMes(fecha)}
          </button>
        )}
      >
        <p className={`text-sm text-muted mt-1 ${esDueno ? 'hidden sm:block' : ''}`}>{fechaLegible(fecha)}</p>
      </PageHeader>

      {soloLectura && (
        <div role="alert" className="mb-4 rounded-2xl bg-info-tint border border-info/30 px-4 py-3 text-sm text-info">
          Este turno ya está cerrado. Solo la dueña puede corregirlo. <Link to="/hoy" className="font-bold underline">Volver a Hoy</Link>
        </div>
      )}
      {state.cerrado && esDueno && (
        <div className="mb-4 rounded-2xl bg-info-tint border border-info/30 px-4 py-3 text-sm text-info">
          Turno cerrado: al guardar se registra una <b>corrección</b> con la fotografía anterior y la nueva.
        </div>
      )}
      {form.errorAutosave && online && (
        <div role="alert" className="mb-4 rounded-2xl bg-neg-tint border border-neg/30 px-4 py-3 text-sm text-neg">
          {form.errorAutosave}
        </div>
      )}

      {/* Modo */}
      <section className="mb-5" aria-label="Tipo de registro">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-soft">
          {MODOS.map((m) => {
            const on = modo === m.value
            const habilitado = disponibles.includes(m.value) || on
            return (
              <button key={m.value} type="button" disabled={!habilitado || soloLectura}
                onClick={() => void navigate({ to: '/turno', search: { fecha, modo: m.value } })}
                aria-pressed={on}
                className={`flex items-center justify-center gap-1.5 min-h-[44px] px-1 rounded-xl text-sm font-semibold whitespace-nowrap transition ${on ? 'bg-card text-brand shadow-card' : 'text-ink2 disabled:opacity-35'}`}>
                <Icon name={m.icon} className="w-4 h-4 shrink-0 max-[380px]:hidden" />{m.label}
              </button>
            )
          })}
        </div>
        {diaUnicoConfig && modo === 'completo' && <p className="text-xs text-muted mt-1.5 px-1">Los {['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'][diaSemana(fecha)]} se registran como un solo turno.</p>}
      </section>

      {/* Quién estaba */}
      <section className="mb-5" aria-label="Quién atendió">
        <h2 className="eyebrow mb-2 px-1">¿Quién atendió?</h2>
        {trabajadores.data && trabajadores.data.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 md:flex-wrap md:overflow-visible md:mx-0 md:px-0" role="radiogroup">
            {trabajadores.data.map((t) => {
              const on = state.trabajadorId === t.id
              return (
                <button key={t.id} type="button" role="radio" aria-checked={on} disabled={soloLectura}
                  onClick={() => cambiar({ type: 'trabajador', id: on ? null : t.id })}
                  className={`shrink-0 min-h-[40px] rounded-full px-4 text-sm font-semibold border ${on ? 'bg-brand text-on-solid border-brand' : 'bg-card text-ink2 border-hairline'}`}>
                  {t.nombre}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted px-1">
            Sin lista de trabajadores.{esDueno && <> Agrégalos en <Link to="/ajustes" search={{ seccion: 'trabajadores' }} className="underline font-semibold">Ajustes</Link>.</>}
          </p>
        )}
      </section>

      {/* Ventas */}
      <section className="mb-5" aria-label="Ventas">
        <div className="flex items-baseline justify-between px-1 mb-2">
          <h2 className="eyebrow">Ventas del {modo === 'completo' ? 'día' : 'turno'}</h2>
          <span className="text-sm font-bold text-brand tabular-nums">{clp(totales.total_ventas)}</span>
        </div>
        <div className="card p-0 divide-y divide-hairline overflow-hidden">
          {(metodos.data ?? []).filter((m) => esMetodo(m.key)).map((m) => {
            const key = m.key as MetodoKey
            const monto = state.ventas[key]
            return (
              <button key={m.key} type="button" disabled={soloLectura} onClick={() => setSheet({ t: 'venta', key })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left min-h-[60px] hover:bg-soft/60 disabled:opacity-70">
                <MetodoLogo metodo={m} active={monto > 0} />
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-medium text-ink">{m.label}</span>
                  {m.acumulado_diario && modo === 'tarde' ? (
                    <span className="block text-xs text-muted tabular-nums">Mañana {clp(turnoManana?.[key] ?? 0)} · total del día {clp(Number(turnoManana?.[key] ?? 0) + monto)}</span>
                  ) : m.sub && <span className="block text-xs text-muted">{m.sub}</span>}
                </span>
                <span className={`text-lg font-bold tabular-nums ${monto ? 'text-ink' : 'text-muted2'}`}>{clp(monto)}</span>
                <Icon name="chevR" className="w-4 h-4 text-muted2" />
              </button>
            )
          })}
        </div>
      </section>

      {/* Proveedores */}
      <section className="mb-5" aria-label="Proveedores">
        <div className="flex items-baseline justify-between px-1 mb-2">
          <h2 className="eyebrow">Proveedores pagados</h2>
          <span className="text-sm font-bold text-brand tabular-nums">{clp(totales.total_proveedores)}</span>
        </div>
        {state.proveedores.length > 0 && (
          <div className="card p-0 divide-y divide-hairline overflow-hidden mb-2">
            {state.proveedores.map((p) => (
              <button key={p.key} type="button" disabled={soloLectura} onClick={() => setSheet({ t: 'prov', linea: p })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left min-h-[56px] hover:bg-soft/60">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.forma_pago === 'efectivo' ? 'bg-pos' : 'bg-info'}`} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-medium text-ink truncate">{p.nombre}</span>
                  <span className="block text-xs text-muted">{p.forma_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
                </span>
                <span className="text-lg font-bold tabular-nums text-ink">{clp(p.monto)}</span>
                <Icon name="chevR" className="w-4 h-4 text-muted2" />
              </button>
            ))}
          </div>
        )}
        {!soloLectura && (
          <button type="button" onClick={() => setSheet({ t: 'prov', linea: null })}
            className={`w-full min-h-[52px] rounded-2xl flex items-center justify-center gap-2 text-sm font-bold ${state.proveedores.length ? 'bg-brand-tint text-brand' : 'border-2 border-dashed border-hairline text-ink2'}`}>
            <Icon name="plus" className="w-5 h-5" stroke={2.2} />{state.proveedores.length ? 'Agregar proveedor' : 'Agrega el primer proveedor'}
          </button>
        )}
      </section>

      {/* Caja */}
      <section className="mb-5" aria-label="Caja">
        <h2 className="eyebrow mb-2 px-1">Caja</h2>
        <div className="card p-0 divide-y divide-hairline overflow-hidden">
          <button type="button" disabled={soloLectura} onClick={() => setSheet({ t: 'fondo' })} className="w-full flex items-center justify-between px-4 py-3 min-h-[56px] text-left">
            <span><span className="block text-base font-medium text-ink">Fondo inicial</span><span className="block text-xs text-muted">Con lo que partió la caja</span></span>
            <span className="text-lg font-bold tabular-nums text-ink">{clp(state.fondoInicial)}</span>
          </button>
          <div className="flex items-center justify-between px-4 py-3 min-h-[56px]">
            <span><span className="block text-base font-medium text-ink">Efectivo esperado</span><span className="block text-xs text-muted">fondo + efectivo − proveedores en efectivo</span></span>
            <span className="text-lg font-bold tabular-nums text-brand">{clp(totales.efectivo_esperado)}</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-medium text-ink">¿Contaste la caja?</span>
              <div className="flex gap-1 p-1 rounded-xl bg-soft" role="radiogroup" aria-label="Conteo de caja">
                <button type="button" role="radio" aria-checked={!state.contoCaja} disabled={soloLectura} onClick={() => cambiar({ type: 'caja', conto: false, monto: null })}
                  className={`min-h-[44px] min-w-[52px] px-3 rounded-lg text-sm font-semibold ${!state.contoCaja ? 'bg-card text-ink shadow-card' : 'text-ink2'}`}>No</button>
                <button type="button" role="radio" aria-checked={state.contoCaja} disabled={soloLectura} onClick={() => setSheet({ t: 'conteo' })}
                  className={`min-h-[44px] min-w-[52px] px-3 rounded-lg text-sm font-semibold ${state.contoCaja ? 'bg-card text-ink shadow-card' : 'text-ink2'}`}>Sí</button>
              </div>
            </div>
            {state.contoCaja && state.efectivoContado != null && (
              <button type="button" disabled={soloLectura} onClick={() => setSheet({ t: 'conteo' })} className="mt-3 w-full flex items-center justify-between text-left">
                <span className="text-sm text-muted">Contado: <b className="text-ink tabular-nums">{clp(state.efectivoContado)}</b></span>
                <span className={`text-sm font-bold tabular-nums ${form.diferenciaCaja === 0 ? 'text-pos' : 'text-neg'}`}>
                  {form.diferenciaCaja === 0 ? 'Cuadra' : `Diferencia ${clpSigno(form.diferenciaCaja ?? 0)}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Barra fija */}
      {!soloLectura && (
        <div ref={barRef} className="fixed inset-x-0 above-nav z-30 bg-card/95 backdrop-blur border-t border-hairline px-4 py-3 md:left-[220px]">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted uppercase tracking-wide font-bold">Neto {modo === 'completo' ? 'del día' : 'del turno'}</p>
              <p className={`amount text-amount-sm leading-none ${totales.neto >= 0 ? 'text-ink' : 'text-neg'}`}>{clp(totales.neto)}</p>
              <p className="text-xs text-muted mt-0.5">
                {state.sucio ? (online ? 'Guardando borrador…' : 'Guardado en este dispositivo') : state.turnoId ? 'Borrador guardado' : ''}
              </p>
            </div>
            <button type="button" onClick={pedirCierre} disabled={form.guardando} className="btn-primary px-5 py-3 text-base min-w-[150px]">
              {form.guardando ? 'Guardando…' : etiquetaCerrar(modo, state.cerrado)}
            </button>
          </div>
        </div>
      )}

      {/* Hojas */}
      {sheet?.t === 'prov' && (
        <ProveedorSheet
          linea={sheet.linea}
          usados={usadosIds}
          onSave={(l) => { cambiar({ type: 'proveedor', linea: l }); setSheet(null) }}
          onDelete={sheet.linea ? (key) => { cambiar({ type: 'quitarProveedor', key }); setSheet(null) } : undefined}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.t === 'venta' && (() => {
        // Teclado encadenado: aceptar pasa al siguiente método sin cerrar la hoja.
        const activos = (metodos.data ?? []).filter((x) => esMetodo(x.key))
        const idx = activos.findIndex((x) => x.key === sheet.key)
        const m = activos[idx]
        const prox = activos[idx + 1]
        // Máquina con total del día y estamos cerrando la tarde: se escribe el
        // total y la hoja deriva la parte de la tarde (total − mañana).
        const mananaMonto = modo === 'tarde' ? Number(turnoManana?.[sheet.key] ?? 0) : null
        const acumulado = m?.acumulado_diario && mananaMonto != null ? { manana: mananaMonto } : undefined
        return (
          <MontoSheet title={m?.label ?? sheet.key} sub={acumulado ? 'La máquina muestra el total del día' : m?.sub ?? undefined} valor={state.ventas[sheet.key]} color={colorMetodo(m?.color)}
            acumulado={acumulado}
            paso={{ actual: idx + 1, total: activos.length }} siguiente={prox?.label ?? null}
            onAccept={(monto, seguir) => {
              cambiar({ type: 'venta', key: sheet.key, monto })
              if (seguir && prox && esMetodo(prox.key)) setSheet({ t: 'venta', key: prox.key })
              else setSheet(null)
            }}
            onClose={() => setSheet(null)} />
        )
      })()}
      {sheet?.t === 'fondo' && (
        <MontoSheet title="Fondo inicial de caja" sub="Con lo que partió la caja" valor={state.fondoInicial}
          onAccept={(monto) => { cambiar({ type: 'fondo', monto }); setSheet(null) }} onClose={() => setSheet(null)} />
      )}
      {sheet?.t === 'conteo' && (
        <ConteoSheet
          inicial={state.desgloseConteo ?? {}}
          esperado={totales.efectivo_esperado}
          onAccept={(total, desglose) => { cambiar({ type: 'caja', conto: true, monto: total, desglose }); setSheet(null) }}
          onTotalManual={() => setSheet({ t: 'conteoTotal' })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.t === 'conteoTotal' && (
        <MontoSheet title="Efectivo contado" sub="Lo que hay en el cajón" valor={state.efectivoContado} label="Registrar conteo"
          ayuda={<p className="text-xs text-muted px-1">Esperado: <b className="text-ink tabular-nums">{clp(totales.efectivo_esperado)}</b></p>}
          onAccept={(monto) => { cambiar({ type: 'caja', conto: true, monto, desglose: null }); setSheet(null) }} onClose={() => setSheet(null)} />
      )}
      {sheet?.t === 'fecha' && (
        <BottomSheet title="Cambiar fecha" onClose={() => setSheet(null)}>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => void navigate({ to: '/turno', search: { fecha: sumarDias(fecha, -1) } })} aria-label="Día anterior"><Icon name="chevL" /></button>
            <input type="date" className="input flex-1 text-center" value={fecha} max={hoy()}
              onChange={(e) => { if (e.target.value) void navigate({ to: '/turno', search: { fecha: e.target.value } }) }} />
            <button type="button" className="btn-secondary" disabled={fecha >= hoy()} onClick={() => void navigate({ to: '/turno', search: { fecha: sumarDias(fecha, 1) } })} aria-label="Día siguiente"><Icon name="chevR" /></button>
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => setSheet(null)}>Listo</button>
        </BottomSheet>
      )}

      {revisar && (
        <RevisionSheet
          modo={modo}
          yaCerrado={state.cerrado}
          metodos={(metodos.data ?? []).filter((m) => esMetodo(m.key))}
          ventas={state.ventas}
          proveedores={state.proveedores}
          trabajador={trabajadores.data?.find((x) => x.id === state.trabajadorId)?.nombre ?? null}
          datos={{
            trabajadorId: state.trabajadorId,
            hayTrabajadores: (trabajadores.data?.length ?? 0) > 0,
            contoCaja: state.contoCaja,
            diferenciaCaja: form.diferenciaCaja,
            totalVentas: totales.total_ventas,
            totalProveedores: totales.total_proveedores,
          }}
          totales={totales}
          fondoInicial={state.fondoInicial}
          efectivoContado={state.efectivoContado}
          guardando={form.guardando}
          onConfirmar={() => void onCerrar()}
          onClose={() => setRevisar(false)}
        />
      )}

      {form.conflicto && (
        <BottomSheet title="Este turno cambió en otro dispositivo" onClose={() => void form.adoptarServidor()}>
          <p className="text-sm text-ink2">
            Mientras escribías, alguien guardó este mismo turno ({etiquetaModo(form.conflicto.actual.modo)} · ventas {clp(form.conflicto.actual.total_ventas)}).
            ¿Qué quieres hacer?
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => void form.adoptarServidor()}>Ver lo que se guardó (descarta lo mío)</button>
          <button type="button" className="btn-secondary w-full" onClick={() => void form.sobrescribir(false)}>Conservar lo mío y reemplazar</button>
        </BottomSheet>
      )}
    </div>
  )
}
