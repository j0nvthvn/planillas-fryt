import { MetodoLogo } from 'frytcontrol'

const metodo = (key: string, label: string, color: string | null) => ({ key, label, logo: null, color })

/** Sin logo cargado, cada método cae a su vector, teñido con su color. */
export const Metodos = () => (
  <div className="card flex flex-wrap items-center gap-3 max-w-md">
    <MetodoLogo metodo={metodo('efectivo', 'Efectivo', '#047857')} />
    <MetodoLogo metodo={metodo('getnet', 'Getnet', '#E4002B')} />
    <MetodoLogo metodo={metodo('mercadopago', 'Mercado Pago', '#00AEEF')} />
    <MetodoLogo metodo={metodo('edenred', 'Edenred', '#EE3124')} />
    <MetodoLogo metodo={metodo('amipass', 'Amipass', '#F58220')} />
    <MetodoLogo metodo={metodo('transferencia', 'Transferencia', '#4F46E5')} />
  </div>
)

/**
 * Dos tamaños (`sm`, `md`) y el genérico, para un método sin dibujo propio.
 * El vector se tiñe con `metodo.color`: sin color no se ve nada, así que
 * conviene que todo método traiga el suyo.
 */
export const Tamanos = () => (
  <div className="card flex items-center gap-3 max-w-md">
    <MetodoLogo metodo={metodo('getnet', 'Getnet', '#E4002B')} size="sm" />
    <MetodoLogo metodo={metodo('getnet', 'Getnet', '#E4002B')} size="md" />
    <MetodoLogo metodo={metodo('otro', 'Otro', '#626B7F')} />
  </div>
)

/** En la lista de ventas por método. */
export const EnLaLista = () => (
  <div className="card max-w-md flex flex-col gap-3">
    {[['efectivo', 'Efectivo', '#047857', '$412.500'], ['getnet', 'Getnet', '#E4002B', '$631.000'], ['mercadopago', 'Mercado Pago', '#00AEEF', '$184.300']].map(([k, l, c, monto]) => (
      <div key={k} className="flex items-center gap-3">
        <MetodoLogo metodo={metodo(k, l, c)} />
        <span className="flex-1 text-md text-ink2">{l}</span>
        <span className="cifra text-sm text-ink">{monto}</span>
      </div>
    ))}
  </div>
)
