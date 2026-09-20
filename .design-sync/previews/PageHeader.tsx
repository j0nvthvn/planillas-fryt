import { Icon, PageHeader } from 'frytcontrol'

/** Encabezado simple de una pantalla. */
export const Simple = () => (
  <div className="p-4 bg-canvas">
    <PageHeader title="Proveedores" />
  </div>
)

/** Con antetítulo, bajada y una acción a la derecha. */
export const Completo = () => (
  <div className="p-4 bg-canvas">
    <PageHeader
      eyebrow="Martes 16 de septiembre"
      title="Planilla del día"
      subtitle="Dos turnos cerrados · caja cuadrada"
      action={<button type="button" className="btn-secondary"><Icon name="download" className="w-[18px] h-[18px]" />Exportar</button>}
    />
  </div>
)

/** Con `back`: en el celular la flecha queda fija arriba al hacer scroll. */
export const ConVolver = () => (
  <div className="p-4 bg-canvas">
    <PageHeader
      back="/proveedores"
      volverAtras
      eyebrow="Proveedor"
      title="Verduras del Sur"
      subtitle="38 pagos · desde marzo"
      action={<button type="button" className="btn-secondary"><Icon name="pencil" className="w-[18px] h-[18px]" />Editar</button>}
    />
  </div>
)

/** Con contenido propio debajo del título (filtros, píldoras). */
export const ConFiltros = () => (
  <div className="p-4 bg-canvas">
    <PageHeader title="Historial">
      <div className="flex gap-2 mt-3">
        <button type="button" className="hit shrink-0 inline-flex items-center min-h-[34px] rounded-[9px] px-3.5 text-sm border bg-ink text-card border-ink font-semibold">Este mes</button>
        <button type="button" className="hit shrink-0 inline-flex items-center min-h-[34px] rounded-[9px] px-3.5 text-sm border bg-card text-ink2 border-hairline-strong font-medium">Mes pasado</button>
      </div>
    </PageHeader>
  </div>
)
