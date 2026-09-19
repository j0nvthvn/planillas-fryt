import { useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import { Menu } from './Menu'
import { etiquetaSeccion, type Seccion } from './secciones'
import { General } from './paneles/General'
import { Apariencia } from './paneles/Apariencia'
import { Correos } from './paneles/Correos'
import { Trabajadores } from './paneles/Trabajadores'
import { Metodos } from './paneles/Metodos'
import { Papelera } from './paneles/Papelera'
import { Usuarios } from './paneles/Usuarios'
import { Errores } from './paneles/Errores'

/** Cada sección es una pantalla propia en `paneles/`. */
const PANELES: Record<Seccion, () => React.ReactElement | null> = {
  general: General,
  apariencia: Apariencia,
  correos: Correos,
  trabajadores: Trabajadores,
  metodos: Metodos,
  papelera: Papelera,
  usuarios: Usuarios,
  errores: Errores,
}

export default function Ajustes() {
  const { seccion } = useSearch({ from: '/app/ajustes' })
  // Celular: la portada es el menú y cada sección abre su pantalla.
  // Escritorio: menú fijo a la izquierda y la sección (General por omisión) al lado.
  const abierta: Seccion = seccion ?? 'general'
  const Panel = PANELES[abierta]
  return (
    <div className="relative isolate max-w-5xl mx-auto md:grid md:grid-cols-[300px_minmax(0,1fr)] md:gap-8 md:items-start">
      {/* En escritorio la banda queda dentro de la columna del menú. */}
      <div className={`md:relative ${seccion ? 'hidden md:block' : ''}`}>
        <Menu activa={abierta} abierta={!!seccion} />
      </div>
      <div className={`${seccion ? '' : 'hidden md:block'} md:pt-5`}>
        <PageHeader title={etiquetaSeccion(abierta)} back="/ajustes" volverAtras className="md:hidden" />
        <h2 className="hidden md:block font-display text-xl font-semibold tracking-[-0.02em] text-ink mb-4">{etiquetaSeccion(abierta)}</h2>
        <Panel />
      </div>
    </div>
  )
}
