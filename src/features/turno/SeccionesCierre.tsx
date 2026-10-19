import { Link } from '@tanstack/react-router'
import Icon from '@/components/Icon'
import { MetodoLogo } from '@/components/MetodoLogo'
import { useRovingRadio } from '@/hooks/useRovingRadio'
import type { MetodoPago, Trabajador } from '@/features/catalogo/api'
import { MODOS, type Modo, type VTurno } from './api'
import type { LineaForm } from './estadoTurno'
import { clp, clpSigno, diaSemana, iniciales } from '@/lib/format'
import { esMetodo, type MetodoKey, type Ventas } from '@/lib/totales'
import { montoDe } from '@/lib/metodos'

/**
 * Las secciones del formulario de cierre. Solo pintan y avisan qué se tocó:
 * los cambios pasan por el reducer (`estadoTurno.ts`) y las hojas las abre
 * la pantalla (`CerrarTurno.tsx`).
 */

export function SeccionModo({ modo, disponibles, soloLectura, fecha, diaUnico, onModo }: {
  modo: Modo; disponibles: Modo[]; soloLectura: boolean; fecha: string; diaUnico: boolean; onModo: (m: Modo) => void
}) {
  return (
    <section className="mb-[18px]" aria-label="Tipo de registro">
      <div className="segmented" role="group" aria-label="Tipo de registro">
        {MODOS.map((m) => {
          const on = modo === m.value
          const habilitado = disponibles.includes(m.value) || on
          return (
            <button key={m.value} type="button" disabled={!habilitado || soloLectura}
              onClick={() => onModo(m.value)}
              aria-pressed={on}
              className={`${on ? 'segmented-item-on' : 'segmented-item disabled:opacity-35'} px-1 whitespace-nowrap`}>
              {m.label}
            </button>
          )
        })}
      </div>
      {diaUnico && modo === 'completo' && <p className="text-xs text-muted mt-1.5 px-1">Los {['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'][diaSemana(fecha)]} se registran como un solo turno.</p>}
    </section>
  )
}

export function SeccionTrabajador({ trabajadores, trabajadorId, soloLectura, esDueno, onElegir }: {
  trabajadores: Trabajador[]; trabajadorId: string | null; soloLectura: boolean; esDueno: boolean; onElegir: (id: string | null) => void
}) {
  // Hasta cuatro caben como segmented; con más, píldoras con scroll.
  const segmented = trabajadores.length <= 4
  return (
    <section className="mb-5" aria-label="Quién atendió">
      <h2 className="eyebrow mb-[9px]">¿Quién atendió?</h2>
      {trabajadores.length > 0 ? (
        <div role="group" aria-label="Quién atendió"
          className={segmented ? 'segmented' : 'flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 md:flex-wrap md:overflow-visible md:mx-0 md:px-0'}
          style={segmented ? { display: 'grid', gridTemplateColumns: `repeat(${trabajadores.length}, minmax(0, 1fr))` } : undefined}>
          {trabajadores.map((t) => {
            const on = trabajadorId === t.id
            return (
              <button key={t.id} type="button" aria-pressed={on} disabled={soloLectura}
                onClick={() => onElegir(on ? null : t.id)}
                className={segmented
                  ? `${on ? 'segmented-item-on' : 'segmented-item'} px-1 min-w-0 truncate`
                  : `hit shrink-0 min-h-[40px] rounded-[9px] px-4 text-sm border ${on ? 'bg-card text-ink font-semibold border-hairline-strong shadow-card' : 'bg-soft text-muted font-medium border-hairline'}`}>
                {t.nombre}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Sin lista de trabajadores.{esDueno && <> Agrégalos en <Link to="/ajustes" search={{ seccion: 'trabajadores' }} className="underline font-semibold">Ajustes</Link>.</>}
        </p>
      )}
    </section>
  )
}

export function SeccionVentas({ metodos, ventas, total, modo, turnoManana, soloLectura, onAbrir }: {
  metodos: MetodoPago[]; ventas: Ventas; total: number; modo: Modo; turnoManana: VTurno | undefined; soloLectura: boolean; onAbrir: (key: MetodoKey) => void
}) {
  return (
    <section className="mb-5" aria-label="Ventas">
      <div className="flex items-baseline justify-between mb-[9px]">
        <h2 className="eyebrow">Ventas del {modo === 'completo' ? 'día' : 'turno'}</h2>
        <span className="cifra text-sm text-ink">{clp(total)}</span>
      </div>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {metodos.filter((m) => esMetodo(m.key)).map((m) => {
          const key = m.key as MetodoKey
          const monto = ventas[key]
          return (
            <button key={m.key} type="button" disabled={soloLectura} onClick={() => onAbrir(key)}
              className="row py-2.5 hover:bg-soft/60">
              <MetodoLogo metodo={m} />
              <span className="flex-1 min-w-0">
                <span className="block text-base font-medium text-ink">{m.label}</span>
                {m.acumulado_diario && modo === 'tarde' ? (
                  <span className="block text-xs text-muted tabular-nums mt-0.5">Mañana {clp(montoDe(turnoManana, key))} · total del día {clp(montoDe(turnoManana, key) + monto)}</span>
                ) : m.sub && <span className="block text-xs text-muted mt-0.5">{m.sub}</span>}
              </span>
              <span className={`cifra text-lg ${monto ? 'text-ink' : 'text-muted2'}`}>{clp(monto)}</span>
              <Icon name="chevR" className="w-[15px] h-[15px] text-muted2 shrink-0" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function SeccionProveedores({ proveedores, total, soloLectura, onAbrir }: {
  proveedores: LineaForm[]; total: number; soloLectura: boolean; onAbrir: (linea: LineaForm | null) => void
}) {
  return (
    <section className="mb-5" aria-label="Proveedores">
      <div className="flex items-baseline justify-between mb-[9px]">
        <h2 className="eyebrow">Proveedores pagados</h2>
        <span className={`cifra text-sm ${total ? 'text-neg' : 'text-ink'}`}>{total ? '−' : ''}{clp(total)}</span>
      </div>
      {proveedores.length > 0 && (
        <div className="card p-0 divide-y divide-hairline overflow-hidden mb-2.5">
          {proveedores.map((p) => (
            <button key={p.key} type="button" disabled={soloLectura} onClick={() => onAbrir(p)}
              className="row py-2.5 hover:bg-soft/60">
              <span className="tile bg-soft text-sm font-semibold text-ink2" aria-hidden="true">{iniciales(p.nombre)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-medium text-ink truncate">{p.nombre}</span>
                <span className={`badge mt-1 px-1.5 py-[3px] rounded-[6px] ${p.forma_pago === 'efectivo' ? 'bg-pos-tint text-pos' : 'bg-brand-tint text-brand'}`}>{p.forma_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
              </span>
              <span className="cifra text-lg text-neg">{p.monto ? '−' : ''}{clp(p.monto)}</span>
              <Icon name="chevR" className="w-[15px] h-[15px] text-muted2 shrink-0" />
            </button>
          ))}
        </div>
      )}
      {!soloLectura && (
        <button type="button" onClick={() => onAbrir(null)}
          className="w-full min-h-[48px] rounded-[12px] bg-card border border-hairline-strong flex items-center justify-center gap-[7px] text-sm font-semibold text-brand hover:bg-soft">
          <Icon name="plus" className="w-[18px] h-[18px]" stroke={2.2} />{proveedores.length ? 'Agregar proveedor' : 'Agrega el primer proveedor'}
        </button>
      )}
    </section>
  )
}

export function SeccionCaja({ fondoInicial, esperado, contoCaja, efectivoContado, diferencia, soloLectura, onFondo, onContar, onNoConto }: {
  fondoInicial: number; esperado: number; contoCaja: boolean; efectivoContado: number | null; diferencia: number | null
  soloLectura: boolean; onFondo: () => void; onContar: () => void; onNoConto: () => void
}) {
  // «¿Contaste la caja?»: Sí abre el conteo; No lo borra.
  const cajaRadio = useRovingRadio([false, true], contoCaja, (conto) => { if (conto) onContar(); else onNoConto() }, () => soloLectura)
  return (
    <section className="mb-5" aria-label="Caja">
      <h2 className="eyebrow mb-[9px]">Caja</h2>
      <div className="card p-0 overflow-hidden">
        <button type="button" disabled={soloLectura} onClick={onFondo} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 min-h-[60px] text-left active:bg-soft">
          <span><span className="block text-base font-medium text-ink">Fondo inicial</span><span className="block text-xs text-muted mt-0.5">Con lo que partió la caja</span></span>
          <span className="cifra text-lg text-ink">{clp(fondoInicial)}</span>
        </button>
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-soft border-y border-hairline">
          <span><span className="block text-base font-semibold text-ink">Efectivo esperado</span><span className="block text-xs text-muted mt-0.5">fondo + efectivo − proveedores en efectivo</span></span>
          <span className="amount text-xl text-ink">{clp(esperado)}</span>
        </div>
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-medium text-ink">¿Contaste la caja?</span>
            <div className="grid grid-cols-2 gap-[3px] p-[3px] rounded-[11px] bg-soft border border-hairline" role="radiogroup" aria-label="Conteo de caja">
              <button type="button" {...cajaRadio(false, 0)} disabled={soloLectura} onClick={onNoConto}
                className={`hit min-h-[38px] min-w-[54px] px-3 rounded-[8px] text-sm transition-colors ${!contoCaja ? 'bg-card text-ink font-semibold shadow-card' : 'text-muted font-medium'}`}>No</button>
              <button type="button" {...cajaRadio(true, 1)} disabled={soloLectura} onClick={onContar}
                className={`hit min-h-[38px] min-w-[54px] px-3 rounded-[8px] text-sm transition-colors ${contoCaja ? 'bg-card text-ink font-semibold shadow-card' : 'text-muted font-medium'}`}>Sí</button>
            </div>
          </div>
          {contoCaja && efectivoContado != null && (
            <button type="button" disabled={soloLectura} onClick={onContar} className="mt-3.5 pt-3.5 border-t border-hairline w-full flex items-center justify-between gap-3 text-left">
              <span className="text-sm text-muted">Contado <b className="font-semibold text-ink tabular-nums">{clp(efectivoContado)}</b></span>
              <span className={`badge text-xs tabular-nums ${diferencia === 0 ? 'bg-pos-tint text-pos' : 'bg-neg-tint text-neg'}`}>
                {diferencia === 0 ? 'Cuadra' : `Descuadre ${clpSigno(diferencia ?? 0)}`}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
