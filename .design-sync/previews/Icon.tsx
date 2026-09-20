import { Icon } from 'frytcontrol'

const NAVEGACION = ['home', 'chart', 'history', 'suppliers', 'settings', 'menu'] as const
const ACCIONES = ['plus', 'minus', 'check', 'close', 'edit', 'trash', 'download', 'refresh', 'undo', 'split', 'merge'] as const
const DOMINIO = ['cash', 'bank', 'wallet', 'store', 'users', 'calendar', 'note', 'summary'] as const
const ESTADO = ['warning', 'info', 'search', 'lock', 'eye', 'eyeOff', 'sun', 'moon'] as const

const Grupo = ({ titulo, nombres }: { titulo: string; nombres: readonly string[] }) => (
  <div className="mb-4">
    <p className="eyebrow mb-2">{titulo}</p>
    <div className="flex flex-wrap gap-3">
      {nombres.map((n) => (
        <span key={n} className="w-10 h-10 rounded-[10px] bg-soft border border-hairline grid place-items-center text-ink2">
          <Icon name={n as 'home'} className="w-5 h-5" />
        </span>
      ))}
    </div>
  </div>
)

/** El juego completo: un solo trazo, 24×24, hereda el color del texto. */
export const Muestrario = () => (
  <div className="card max-w-lg">
    <Grupo titulo="Navegación" nombres={NAVEGACION} />
    <Grupo titulo="Acciones" nombres={ACCIONES} />
    <Grupo titulo="Dominio" nombres={DOMINIO} />
    <Grupo titulo="Estado" nombres={ESTADO} />
  </div>
)

/** Tamaño por clase y grosor por `stroke`; el color viene del texto. */
export const TamanosYColor = () => (
  <div className="card flex items-center gap-5 max-w-md">
    <Icon name="warning" className="w-4 h-4 text-warn" stroke={2} />
    <Icon name="check" className="w-5 h-5 text-pos" />
    <Icon name="trash" className="w-6 h-6 text-neg" stroke={1.6} />
    <Icon name="store" className="w-8 h-8 text-brand" stroke={1.4} />
  </div>
)
