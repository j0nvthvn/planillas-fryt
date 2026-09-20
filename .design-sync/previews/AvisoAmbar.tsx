import { AvisoAmbar } from 'frytcontrol'

/** Turnos sin cerrar de días anteriores (Hoy). */
export const TurnosSinCerrar = () => (
  <div className="max-w-md">
    <AvisoAmbar titulo="Hay 2 turnos sin cerrar">
      <ul className="mt-1.5 flex flex-col gap-1">
        <li className="text-sm text-ink2">Lunes 15 · mañana</li>
        <li className="text-sm text-ink2">Martes 16 · tarde</li>
      </ul>
    </AvisoAmbar>
  </div>
)

/** Posibles duplicados en el catálogo de proveedores. */
export const PosiblesDuplicados = () => (
  <div className="max-w-md">
    <AvisoAmbar titulo="Posibles duplicados">
      <p className="text-sm text-ink2 mt-1">
        «Verduras del Sur» y «Verduras Del Sur» se escriben casi igual. Si son el
        mismo, conviene unirlos para que el historial quede en una sola ficha.
      </p>
    </AvisoAmbar>
  </div>
)
