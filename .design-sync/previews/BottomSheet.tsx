import { BottomSheet } from 'frytcontrol'

/** Hoja con título, contenido desplazable y pie fijo con las acciones. */
export const ConPie = () => (
  <BottomSheet
    title="Conteo de caja"
    onClose={() => {}}
    footer={
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1 btn-lg">Cancelar</button>
        <button type="button" className="btn-primary flex-1 btn-lg">Guardar conteo</button>
      </div>
    }
  >
    <p className="text-sm text-ink2">Cuenta el efectivo de la caja y anota el total. Si no cuadra, la diferencia queda registrada.</p>
    <div className="rounded-[14px] bg-soft border border-hairline px-4 py-3.5 mt-3">
      <p className="eyebrow mb-2">Efectivo esperado</p>
      <p className="amount text-2xl text-ink leading-none">$260.000</p>
    </div>
  </BottomSheet>
)

/** Sin pie: solo contenido, como en la hoja de la fecha. */
export const Simple = () => (
  <BottomSheet title="Elegir fecha" onClose={() => {}}>
    <div className="flex flex-col gap-2">
      {['Hoy · martes 16', 'Ayer · lunes 15', 'Domingo 14'].map((d) => (
        <button key={d} type="button" className="w-full text-left rounded-[12px] border border-hairline px-4 py-3 text-md text-ink2 hover:bg-soft">{d}</button>
      ))}
    </div>
  </BottomSheet>
)
