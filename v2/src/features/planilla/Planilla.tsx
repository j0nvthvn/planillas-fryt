import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import Spinner from '@/components/Spinner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CorreccionModal } from '@/components/CorreccionModal'
import { useToast } from '@/components/Toast'
import { useUsuario } from '@/hooks/useUsuario'
import { useMetodos } from '@/features/catalogo/api'
import { useResumenDia, useTurnosDia, useCierres, guardarTurno, eliminarTurno, etiquetaModo, type TurnoConLineas } from '@/features/turno/api'
import { EstadoChip, Dato } from '@/features/hoy/Hoy'
import { Ledger, LedgerHead, LedgerLine, LedgerTotal } from '@/components/Ledger'
import { clp, clpSigno, fechaSinAnio, sumarDias, hoy, horaCorta } from '@/lib/format'
import { esMetodo, type MetodoKey } from '@/lib/totales'
import { mensajeDeError } from '@/lib/errorLog'

const FLECHA = 'hit w-[38px] h-[38px] rounded-[10px] grid place-items-center bg-card border border-hairline-strong text-ink2 hover:bg-soft'
const ACCION = 'hit btn min-h-[40px] rounded-[10px] px-3 text-sm text-ink2 bg-card border border-hairline-strong hover:bg-soft'

export default function Planilla() {
  const { fecha } = useSearch({ from: '/app/dia' })
  const navigate = useNavigate()
  const toast = useToast()
  const { esDueno } = useUsuario()
  const resumen = useResumenDia(fecha)
  const turnos = useTurnosDia(fecha)
  const metodos = useMetodos()
  const [accion, setAccion] = useState<{ t: 'dividir' | 'unir' | 'eliminar'; turno: TurnoConLineas } | null>(null)
  const [diff, setDiff] = useState<TurnoConLineas | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const lista = turnos.data ?? []
  const r = resumen.data
  const puedeUnir = lista.length === 1 && lista[0]?.turno.modo === 'mañana'
  const esCompleto = lista.some((t) => t.turno.modo === 'completo')

  async function ejecutar() {
    if (!accion) return
    setOcupado(true)
    try {
      const { turno } = accion.turno
      if (accion.t === 'eliminar') {
        await eliminarTurno(turno.id, fecha)
        toast.show({ message: 'Turno enviado a la papelera', actionLabel: 'Ver papelera', onAction: () => void navigate({ to: '/ajustes', search: { seccion: 'papelera' } }) })
      } else {
        // Dividir: el día completo pasa a ser solo "mañana". Unir: la mañana pasa
        // a día completo. Solo cambia la marca del día (jornadas.es_turno_unico):
        // sin ventas ni proveedores en la llamada, guardar_turno no toca montos
        // ni registra una corrección (igual que "Fusionar" en la app actual).
        const modo = accion.t === 'dividir' ? 'mañana' : 'completo'
        const res = await guardarTurno({ fecha, modo, cerrar: false, base_updated_at: turno.updated_at })
        if (res.conflicto) { toast.error('El turno cambió en otro dispositivo. Recarga e inténtalo de nuevo.'); return }
        toast.ok(accion.t === 'dividir' ? 'Día dividido. Ahora puedes cerrar la tarde.' : 'Registrado como día completo')
        if (accion.t === 'dividir') void navigate({ to: '/turno', search: { fecha, modo: 'tarde' } })
      }
    } catch (e) {
      toast.error(mensajeDeError(e))
    } finally {
      setOcupado(false)
      setAccion(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={fechaSinAnio(fecha, true)} subtitle={`Planilla del día${fecha.slice(0, 4) === hoy().slice(0, 4) ? '' : ` · ${fecha.slice(0, 4)}`}`} back={esDueno ? '/historial' : '/hoy'} volverAtras
        action={
          <div className="flex gap-1.5">
            <Link to="/dia" search={{ fecha: sumarDias(fecha, -1) }} replace className={FLECHA} aria-label="Día anterior"><Icon name="chevL" className="w-[17px] h-[17px]" stroke={1.9} /></Link>
            <Link to="/dia" search={{ fecha: sumarDias(fecha, 1) }} replace disabled={fecha >= hoy()} className={`${FLECHA} ${fecha >= hoy() ? 'opacity-50 pointer-events-none' : ''}`} aria-label="Día siguiente"><Icon name="chevR" className="w-[17px] h-[17px]" stroke={1.9} /></Link>
          </div>
        }
      />

      {turnos.isPending ? <Spinner /> : (
        <>
          <section aria-label="Neto del día" className="card mb-3">
            <div className="flex items-center justify-between gap-2.5"><p className="eyebrow">Neto del día</p><EstadoChip estado={r?.estado ?? 'sin_registro'} /></div>
            <p className={`amount text-amount leading-[1.05] mt-2.5 ${Number(r?.neto ?? 0) < 0 ? 'text-neg' : 'text-ink'}`}>{clp(r?.neto ?? 0)}</p>
            <div className="flex gap-3 mt-4 pt-3.5 border-t border-hairline">
              <Dato label="Ventas">{clp(r?.total_ventas ?? 0)}</Dato>
              <span className="w-px bg-hairline" aria-hidden="true" />
              <Dato label="Proveedores" className={Number(r?.total_proveedores ?? 0) > 0 ? 'text-neg' : 'text-ink'}>{Number(r?.total_proveedores ?? 0) > 0 ? '−' : ''}{clp(r?.total_proveedores ?? 0)}</Dato>
              <span className="w-px bg-hairline" aria-hidden="true" />
              <Dato label="En caja">{clp(r?.efectivo_esperado ?? 0)}</Dato>
            </div>
          </section>

          {lista.length === 0 && (
            <div className="card text-center py-8 mb-3">
              <p className="text-ink2 font-medium">Sin registro este día</p>
              <Link to="/turno" search={{ fecha }} className="btn-primary mt-4">Registrar</Link>
            </div>
          )}

          <div className={`grid gap-3 ${lista.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {lista.map((t) => <TarjetaTurno key={t.turno.id} t={t} fecha={fecha} esDueno={esDueno} metodos={metodos.data ?? []} onDiff={() => setDiff(t)} onAccion={(a) => setAccion({ t: a, turno: t })} puedeUnir={puedeUnir} esCompleto={esCompleto} />)}
          </div>

          {esDueno && lista.length === 1 && lista[0]?.turno.modo === 'mañana' && !lista[0].turno.is_draft && (
            <Link to="/turno" search={{ fecha, modo: 'tarde' }} className="btn-secondary w-full mt-3"><Icon name="moon" className="w-4 h-4" />Registrar turno tarde</Link>
          )}
        </>
      )}

      {accion && (
        <ConfirmDialog
          title={accion.t === 'dividir' ? '¿Dividir en dos turnos?' : accion.t === 'unir' ? '¿Unir como día completo?' : '¿Enviar a la papelera?'}
          message={accion.t === 'dividir' ? 'Lo registrado queda como turno de mañana y podrás cerrar la tarde aparte.' : accion.t === 'unir' ? 'El turno de mañana pasa a representar todo el día.' : 'El turno deja de contar en los totales. Se puede restaurar desde Ajustes → Papelera.'}
          confirmLabel={accion.t === 'eliminar' ? 'Enviar a papelera' : 'Confirmar'} danger={accion.t === 'eliminar'} loading={ocupado}
          onCancel={() => setAccion(null)} onConfirm={() => void ejecutar()} />
      )}
      {diff && <DiffLoader t={diff} metodos={metodos.data ?? []} onClose={() => setDiff(null)} />}
    </div>
  )
}

function DiffLoader({ t, metodos, onClose }: { t: TurnoConLineas; metodos: ReturnType<typeof useMetodos>['data'] & object; onClose: () => void }) {
  const cierres = useCierres(t.turno.id)
  if (cierres.isPending) return null
  return <CorreccionModal cierres={cierres.data ?? []} metodos={metodos} titulo={`${etiquetaModo(t.turno.modo)} · correcciones`} onClose={onClose} />
}

function TarjetaTurno({ t, fecha, esDueno, metodos, onDiff, onAccion, puedeUnir, esCompleto }: {
  t: TurnoConLineas; fecha: string; esDueno: boolean; metodos: { key: string; label: string; color: string }[]
  onDiff: () => void; onAccion: (a: 'dividir' | 'unir' | 'eliminar') => void; puedeUnir: boolean; esCompleto: boolean
}) {
  const { turno, proveedores } = t
  const v = turno as unknown as Record<string, number | null>
  return (
    <article className="card p-0 overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hairline flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{etiquetaModo(turno.modo)}</h2>
          <p className="text-xs text-muted mt-[3px]">{turno.trabajador_nombre ?? turno.usuario_nombre ?? '—'}{turno.ultimo_cierre_en ? ` · cerrado ${horaCorta(turno.ultimo_cierre_en)}` : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {turno.is_draft ? <span className="badge bg-warn-tint text-warn">Borrador</span>
            : turno.corregido ? <button type="button" onClick={onDiff} aria-label="Corregido: ver la corrección" className="hit badge min-h-[36px] gap-1 bg-brand-tint text-brand">Corregido<Icon name="chevR" className="w-3.5 h-3.5" stroke={2.4} /></button>
            : <span className="badge bg-pos-tint text-pos">Cerrado</span>}
        </div>
      </div>
      {/* Cuaderno: la planilla de papel pasada a limpio */}
      <div className="px-[18px] pt-1.5 pb-3.5">
        <Ledger>
          <LedgerHead label="Ventas" />
          {metodos.filter((m) => esMetodo(m.key) && (v[m.key] ?? 0) > 0).map((m) => (
            <LedgerLine key={m.key} label={m.label} value={v[m.key as MetodoKey]} />
          ))}
          <LedgerTotal label="Total ventas" value={Number(turno.total_ventas ?? 0)} size="sm" />
          {proveedores.length > 0 && <LedgerHead label="Proveedores" />}
          {proveedores.map((p) => (
            <LedgerLine key={p.id} label={p.nombre} hint={p.forma_pago === 'efectivo' ? <><span aria-hidden="true">ef.</span><span className="sr-only">efectivo</span></> : <><span aria-hidden="true">tr.</span><span className="sr-only">transferencia</span></>} dot={p.forma_pago === 'efectivo' ? 'pos' : 'info'} value={-Number(p.monto)} color="var(--neg)" />
          ))}
          <LedgerHead label="Caja" />
          <LedgerLine label="Fondo inicial" value={turno.fondo_inicial} />
          <LedgerLine label="Efectivo esperado" value={turno.efectivo_esperado} />
          {turno.efectivo_contado != null
            ? <LedgerLine label="Contado" hint={turno.diferencia_efectivo ? clpSigno(Number(turno.diferencia_efectivo)) : 'cuadra'} hintTone={turno.diferencia_efectivo ? 'neg' : 'pos'} value={turno.efectivo_contado} color={turno.diferencia_efectivo ? 'var(--neg)' : 'var(--pos)'} />
            : <LedgerLine label="Contado" hint="sin conteo" value={null} muted />}
        </Ledger>
      </div>
      <LedgerTotal label={`Neto ${turno.modo === 'completo' ? 'del día' : 'del turno'}`} value={Number(turno.neto ?? 0)} color={Number(turno.neto ?? 0) < 0 ? 'var(--neg)' : undefined} className="border-t border-hairline" />
      {esDueno && (
        <div className="px-3 py-2.5 border-t border-hairline flex flex-wrap gap-1.5">
          <Link to="/turno" search={{ fecha, modo: turno.modo }} className={ACCION}><Icon name="pencil" className="w-[15px] h-[15px]" stroke={1.9} />{turno.is_draft ? 'Seguir' : 'Corregir'}</Link>
          {esCompleto && turno.modo === 'completo' && <button type="button" onClick={() => onAccion('dividir')} className={ACCION}><Icon name="split" className="w-[15px] h-[15px]" stroke={1.9} />Dividir en dos turnos</button>}
          {puedeUnir && turno.modo === 'mañana' && <button type="button" onClick={() => onAccion('unir')} className={ACCION}><Icon name="merge" className="w-[15px] h-[15px]" stroke={1.9} />Unir como día completo</button>}
          <button type="button" onClick={() => onAccion('eliminar')} className="hit btn min-h-[40px] rounded-[10px] px-3 text-sm text-neg hover:bg-neg-tint ml-auto"><Icon name="trash" className="w-[15px] h-[15px]" stroke={1.9} />Eliminar</button>
        </div>
      )}
    </article>
  )
}
