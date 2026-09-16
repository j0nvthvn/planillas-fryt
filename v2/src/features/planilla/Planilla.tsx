import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import Spinner from '@/components/Spinner'
import Amount from '@/components/Amount'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CorreccionModal } from '@/components/CorreccionModal'
import { useToast } from '@/components/Toast'
import { useUsuario } from '@/hooks/useUsuario'
import { useMetodos } from '@/features/catalogo/api'
import { useResumenDia, useTurnosDia, useCierres, guardarTurno, eliminarTurno, etiquetaModo, type TurnoConLineas } from '@/features/turno/api'
import { EstadoChip } from '@/features/hoy/Hoy'
import { Ledger, LedgerHead, LedgerLine, LedgerTotal } from '@/components/Ledger'
import { clp, clpSigno, fechaLegible, fechaDiaMes, sumarDias, hoy, horaCorta } from '@/lib/format'
import { esMetodo, type MetodoKey } from '@/lib/totales'
import { mensajeDeError } from '@/lib/errorLog'

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
      <PageHeader eyebrow="Planilla del día" title={fechaDiaMes(fecha)} subtitle={fechaLegible(fecha)} back={esDueno ? '/historial' : '/hoy'}
        action={
          <div className="flex gap-1">
            <Link to="/dia" search={{ fecha: sumarDias(fecha, -1) }} className="btn-secondary px-3" aria-label="Día anterior"><Icon name="chevL" /></Link>
            <Link to="/dia" search={{ fecha: sumarDias(fecha, 1) }} disabled={fecha >= hoy()} className={`btn-secondary px-3 ${fecha >= hoy() ? 'opacity-40 pointer-events-none' : ''}`} aria-label="Día siguiente"><Icon name="chevR" /></Link>
          </div>
        }
      />

      {turnos.isPending ? <Spinner /> : (
        <>
          <div className="card-hero mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1"><p className="eyebrow">Neto del día</p><EstadoChip estado={r?.estado ?? 'sin_registro'} /></div>
              <Amount variant="hero" color={(r?.neto ?? 0) >= 0 ? 'pos' : 'neg'} value={r?.neto ?? 0} />
            </div>
            <div className="text-right text-xs text-muted space-y-0.5">
              <p>Ventas <b className="text-ink tabular-nums">{clp(r?.total_ventas ?? 0)}</b></p>
              <p>Proveedores <b className="text-ink tabular-nums">{clp(r?.total_proveedores ?? 0)}</b></p>
              <p>Efectivo esperado <b className="text-brand tabular-nums">{clp(r?.efectivo_esperado ?? 0)}</b></p>
            </div>
          </div>

          {lista.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-ink2 font-medium">Sin registro este día</p>
              <Link to="/turno" search={{ fecha }} className="btn-primary mt-4">Registrar</Link>
            </div>
          )}

          <div className={`grid gap-4 ${lista.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {lista.map((t) => <TarjetaTurno key={t.turno.id} t={t} fecha={fecha} esDueno={esDueno} metodos={metodos.data ?? []} onDiff={() => setDiff(t)} onAccion={(a) => setAccion({ t: a, turno: t })} puedeUnir={puedeUnir} esCompleto={esCompleto} />)}
          </div>

          {esDueno && lista.length === 1 && lista[0]?.turno.modo === 'mañana' && !lista[0].turno.is_draft && (
            <Link to="/turno" search={{ fecha, modo: 'tarde' }} className="btn-secondary w-full mt-4"><Icon name="moon" className="w-4 h-4" />Registrar turno tarde</Link>
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
      <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">{etiquetaModo(turno.modo)}</h2>
          <p className="text-xs text-muted">{turno.trabajador_nombre ?? turno.usuario_nombre ?? '—'}{turno.ultimo_cierre_en ? ` · cerrado ${horaCorta(turno.ultimo_cierre_en)}` : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {turno.is_draft ? <span className="text-xs font-bold uppercase text-warn bg-warn-tint rounded-full px-2 py-0.5">Borrador</span>
            : turno.corregido ? <button type="button" onClick={onDiff} aria-label="Corregido: ver la corrección" className="whitespace-nowrap min-h-[36px] inline-flex items-center gap-1 text-xs font-bold uppercase text-info bg-info-tint rounded-full px-3">Corregido<Icon name="chevR" className="w-3.5 h-3.5" stroke={2.4} /></button>
            : <span className="text-xs font-bold uppercase text-pos bg-pos-tint rounded-full px-2 py-0.5">Cerrado</span>}
        </div>
      </div>
      {/* Cuaderno: la planilla de papel pasada a limpio */}
      <div className="px-5 pt-1 pb-4">
        <Ledger>
          <LedgerHead label="Ventas" />
          {metodos.filter((m) => esMetodo(m.key) && (v[m.key] ?? 0) > 0).map((m) => (
            <LedgerLine key={m.key} label={m.label} value={v[m.key as MetodoKey]} />
          ))}
          {proveedores.length > 0 && <LedgerHead label="Proveedores" />}
          {proveedores.map((p) => (
            <LedgerLine key={p.id} label={p.nombre} hint={p.forma_pago === 'efectivo' ? 'ef.' : 'tr.'} dot={p.forma_pago === 'efectivo' ? 'pos' : 'info'} value={p.monto} />
          ))}
          <LedgerHead label="Caja" />
          <LedgerLine label="Fondo inicial" value={turno.fondo_inicial} />
          <LedgerLine label="Efectivo esperado" value={turno.efectivo_esperado} color="var(--brand)" />
          {turno.efectivo_contado != null
            ? <LedgerLine label="Contado" hint={turno.diferencia_efectivo ? clpSigno(Number(turno.diferencia_efectivo)) : 'cuadra'} value={turno.efectivo_contado} color={turno.diferencia_efectivo ? 'var(--neg)' : 'var(--pos)'} />
            : <LedgerLine label="Contado" hint="sin conteo" value={null} muted />}
          <LedgerTotal label="Neto" value={Number(turno.neto ?? 0)} color={Number(turno.neto ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)'} />
          <LedgerTotal label={`Ventas ${clp(turno.total_ventas)} − proveedores ${clp(turno.total_proveedores)}`} value={Number(turno.total_ventas ?? 0)} size="sm" />
        </Ledger>
      </div>
      {esDueno && (
        <div className="px-3 py-2 border-t border-hairline flex flex-wrap gap-1">
          <Link to="/turno" search={{ fecha, modo: turno.modo }} className="btn-ghost text-sm min-h-[40px]"><Icon name="pencil" className="w-4 h-4" />{turno.is_draft ? 'Seguir' : 'Corregir'}</Link>
          {esCompleto && turno.modo === 'completo' && <button type="button" onClick={() => onAccion('dividir')} className="btn-ghost text-sm min-h-[40px]"><Icon name="split" className="w-4 h-4" />Dividir en dos turnos</button>}
          {puedeUnir && turno.modo === 'mañana' && <button type="button" onClick={() => onAccion('unir')} className="btn-ghost text-sm min-h-[40px]"><Icon name="merge" className="w-4 h-4" />Unir como día completo</button>}
          <button type="button" onClick={() => onAccion('eliminar')} className="btn-ghost text-sm min-h-[40px] text-neg ml-auto"><Icon name="trash" className="w-4 h-4" />Eliminar</button>
        </div>
      )}
    </article>
  )
}
