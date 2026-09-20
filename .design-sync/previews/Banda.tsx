import { Banda } from 'frytcontrol'

/**
 * La banda va detrás del encabezado: el contenedor de la página debe ser
 * `relative isolate` y la primera tarjeta queda montada encima.
 */
export const DetrasDelSaludo = () => (
  <div className="relative isolate px-4 pt-6 pb-4 bg-canvas min-h-[280px]">
    <Banda className="md:h-[210px]" alto={176} />
    <div className="pb-5">
      <p className="text-sm text-white/80">Martes 16 de septiembre</p>
      <p className="font-display text-2xl font-semibold text-white mt-0.5">Buenas tardes, Camila</p>
    </div>
    <div className="card">
      <p className="eyebrow">Neto del día</p>
      <p className="amount text-hero leading-[1.05] text-ink mt-2.5">$1.082.000</p>
    </div>
  </div>
)

/** Más baja, como en el menú de Ajustes. */
export const EnAjustes = () => (
  <div className="relative isolate px-4 pt-6 pb-4 bg-canvas min-h-[240px]">
    <Banda className="md:h-[150px]" alto={128} />
    <p className="font-display text-2xl font-semibold text-white mb-5">Ajustes</p>
    <div className="card">
      <p className="text-md font-medium text-ink">General</p>
      <p className="text-xs text-muted mt-0.5">Fondo de caja, corte de la mañana</p>
    </div>
  </div>
)
