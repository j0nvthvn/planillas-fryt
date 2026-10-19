import type { MetodoPago } from '@/features/catalogo/api'
import type { Modo, VTurno } from './api'
import type { Accion, FormState, LineaForm } from './estadoTurno'
import { FechaSheet } from './FechaSheet'
import { ProveedorSheet } from './ProveedorSheet'
import { MontoSheet } from './MontoSheet'
import { ConteoSheet } from './ConteoSheet'
import { clp } from '@/lib/format'
import { esMetodo, type MetodoKey } from '@/lib/totales'
import { montoDe } from '@/lib/metodos'

/** Qué hoja de edición está abierta en el cierre (una a la vez). */
export type HojaCierre =
  | { t: 'prov'; linea: LineaForm | null }
  | { t: 'venta'; key: MetodoKey }
  | { t: 'fondo' }
  | { t: 'conteo' }
  | { t: 'conteoTotal' }
  | { t: 'fecha' }

/**
 * Las hojas para editar el cierre: proveedor, monto por método (con el
 * teclado encadenado), fondo, conteo de caja y fecha. Cada una aplica su
 * cambio con `cambiar` y se cierra o pasa a la siguiente con `abrir`.
 */
export function HojasCierre({ hoja, abrir, state, cambiar, metodos, modo, turnoManana, esperado, fecha, onFecha }: {
  hoja: HojaCierre | null
  abrir: (h: HojaCierre | null) => void
  state: FormState
  cambiar: (a: Accion) => void
  metodos: MetodoPago[]
  modo: Modo
  turnoManana: VTurno | undefined
  esperado: number
  fecha: string
  onFecha: (f: string) => void
}) {
  const cerrar = () => abrir(null)
  if (!hoja) return null
  switch (hoja.t) {
    case 'prov': return (
      <ProveedorSheet
        linea={hoja.linea}
        usados={state.proveedores.map((p) => p.proveedor_id).filter((x): x is string => !!x)}
        onSave={(l) => { cambiar({ type: 'proveedor', linea: l }); cerrar() }}
        onDelete={hoja.linea ? (key) => { cambiar({ type: 'quitarProveedor', key }); cerrar() } : undefined}
        onClose={cerrar}
      />
    )
    case 'venta': {
      // Teclado encadenado: aceptar pasa al siguiente método sin cerrar la hoja.
      const activos = metodos.filter((x) => esMetodo(x.key))
      const idx = activos.findIndex((x) => x.key === hoja.key)
      const m = activos[idx]
      const prox = activos[idx + 1]
      // Máquina con total del día y estamos cerrando la tarde: se escribe el
      // total y la hoja deriva la parte de la tarde (total − mañana).
      const mananaMonto = modo === 'tarde' ? montoDe(turnoManana, hoja.key) : null
      const acumulado = m?.acumulado_diario && mananaMonto != null ? { manana: mananaMonto } : undefined
      return (
        <MontoSheet title={m?.label ?? hoja.key} sub={acumulado ? 'La máquina muestra el total del día' : m?.sub ?? undefined} valor={state.ventas[hoja.key]}
          acumulado={acumulado}
          paso={{ actual: idx + 1, total: activos.length }} siguiente={prox?.label ?? null}
          onAccept={(monto, seguir) => {
            cambiar({ type: 'venta', key: hoja.key, monto })
            if (seguir && prox && esMetodo(prox.key)) abrir({ t: 'venta', key: prox.key })
            else cerrar()
          }}
          onClose={cerrar} />
      )
    }
    case 'fondo': return (
      <MontoSheet title="Fondo inicial de caja" sub="Con lo que partió la caja" valor={state.fondoInicial}
        onAccept={(monto) => { cambiar({ type: 'fondo', monto }); cerrar() }} onClose={cerrar} />
    )
    case 'conteo': return (
      <ConteoSheet
        inicial={state.desgloseConteo ?? {}}
        esperado={esperado}
        onAccept={(total, desglose) => { cambiar({ type: 'caja', conto: true, monto: total, desglose }); cerrar() }}
        onTotalManual={() => abrir({ t: 'conteoTotal' })}
        onClose={cerrar}
      />
    )
    case 'conteoTotal': return (
      <MontoSheet title="Efectivo contado" sub="Lo que hay en el cajón" valor={state.efectivoContado} label="Registrar conteo"
        ayuda={<p className="text-xs text-muted px-1">Esperado: <b className="text-ink tabular-nums">{clp(esperado)}</b></p>}
        onAccept={(monto) => { cambiar({ type: 'caja', conto: true, monto, desglose: null }); cerrar() }} onClose={cerrar} />
    )
    case 'fecha': return <FechaSheet fecha={fecha} onFecha={onFecha} onClose={cerrar} />
  }
}
