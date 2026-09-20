import { ProveedorAvatar } from 'frytcontrol'

/** Sin imagen: la inicial sobre un color estable, derivado del nombre. */
export const Iniciales = () => (
  <div className="card flex flex-wrap items-center gap-3 max-w-md">
    {['Verduras del Sur', 'Panadería Lo Ovalle', 'Distribuidora Ñuñoa', 'Carnes San Pedro', 'Abarrotes Quinta', 'Lácteos Maipú'].map((n) => (
      <ProveedorAvatar key={n} nombre={n} />
    ))}
  </div>
)

/** Los tres tamaños: `sm` en listas, `md` por defecto, `lg` en la ficha. */
export const Tamanos = () => (
  <div className="card flex items-end gap-3 max-w-md">
    <ProveedorAvatar nombre="Verduras del Sur" size="sm" />
    <ProveedorAvatar nombre="Verduras del Sur" size="md" />
    <ProveedorAvatar nombre="Verduras del Sur" size="lg" />
  </div>
)

/** En la lista de proveedores, con el monto del día. */
export const EnLaLista = () => (
  <div className="card max-w-md flex flex-col gap-3">
    {[['Verduras del Sur', '$128.000'], ['Panadería Lo Ovalle', '$74.500']].map(([n, monto]) => (
      <div key={n} className="flex items-center gap-3">
        <ProveedorAvatar nombre={n} />
        <span className="flex-1 text-md text-ink2 truncate">{n}</span>
        <span className="cifra text-sm text-neg">−{monto}</span>
      </div>
    ))}
  </div>
)
