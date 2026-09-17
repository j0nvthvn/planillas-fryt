import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import Icon from '@/components/Icon'
import { Banda } from '@/components/Banda'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useUsuario } from '@/hooks/useUsuario'
import { useConfig } from '@/features/catalogo/api'
import { cerrarSesion } from '@/lib/auth'
import { iniciales } from '@/lib/format'
import { GRUPOS, type Seccion } from './secciones'

/** Fila a todo el ancho en el celular; en escritorio, dentro de la tarjeta. */
const FILA = 'flex w-full items-center gap-3.5 min-h-[56px] px-4 sm:px-6 md:px-4 py-2 transition-colors hover:bg-soft'
/** Grupo a sangre completa: anula el padding de `main` en el celular. */
const GRUPO = 'py-1.5 -mx-4 sm:-mx-6 md:mx-0'

/**
 * Portada de Ajustes: banda con la cuenta, Proveedores destacado y la lista
 * de secciones. `activa` se resalta en escritorio, donde se ve al lado;
 * `abierta` dice si además es la página actual (hay `seccion` en la URL).
 */
export function Menu({ activa, abierta }: { activa: Seccion; abierta: boolean }) {
  const { usuario, esDueno } = useUsuario()
  const { config } = useConfig()
  const [salir, setSalir] = useState(false)
  return (
    <>
      <Banda className="h-[196px] md:h-[208px]" />
      <header className="pt-1 mb-7 md:px-5 md:pt-5">
        <div className="flex items-center gap-3 min-w-0">
          <span aria-hidden="true" className="w-12 h-12 rounded-full bg-white/15 ring-2 ring-white/70 text-white text-base font-semibold grid place-items-center shrink-0">{iniciales(usuario?.nombre)}</span>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-white truncate">{usuario?.nombre ?? 'Ajustes'}</h1>
            <p className="text-xs text-white/80 mt-1 truncate">{[esDueno ? 'Dueña' : 'Cuenta del local', usuario?.email].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <Link to="/ajustes" search={{ seccion: 'general' }}
          className="mt-4 flex items-center gap-3 min-h-[44px] rounded-[14px] bg-white/15 px-4 text-white hover:bg-white/25 transition-colors">
          <img src="/logo.jpg" alt="" width={24} height={24} className="w-6 h-6 rounded-full shrink-0" />
          <span className="flex-1 min-w-0 text-sm font-semibold truncate">{config.nombreLocal || 'Minimarket Fryt'}</span>
          <Icon name="chevR" className="w-4 h-4 shrink-0" />
        </Link>
      </header>

      <Link to="/proveedores" className="borde-marca flex items-center gap-3 rounded-[16px] px-4 py-3.5 mb-5">
        <span className="w-10 h-10 rounded-[11px] bg-brand-tint text-brand grid place-items-center shrink-0" aria-hidden="true"><Icon name="suppliers" className="w-5 h-5" /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-base font-semibold text-ink">Proveedores</span>
          <span className="block text-sm text-muted mt-0.5">Renombrar, fusionar duplicados y logos</span>
        </span>
        <Icon name="chevR" className="w-[18px] h-[18px] text-brand shrink-0" />
      </Link>

      <nav aria-label="Secciones de Ajustes" className="md:card md:p-0 md:overflow-hidden">
        {GRUPOS.map((g, i) => (
          <section key={g.titulo} aria-labelledby={`ajustes-grupo-${i}`} className={`${GRUPO} ${i ? 'border-t border-hairline' : ''}`}>
            <h2 id={`ajustes-grupo-${i}`} className="sr-only">{g.titulo}</h2>
            <ul>
              {g.items.map((it) => {
                const on = activa === it.v
                return (
                  <li key={it.v}>
                    <Link to="/ajustes" search={{ seccion: it.v }} aria-current={on && abierta ? 'page' : undefined}
                      className={`${FILA} ${on ? 'md:bg-brand-tint' : ''}`}>
                      <Icon name={it.icon} className={`w-[22px] h-[22px] shrink-0 ${on ? 'md:text-brand' : 'text-ink2'}`} stroke={1.8} />
                      <span className="flex-1 min-w-0">
                        <span className={`block text-base text-ink ${on ? 'font-semibold' : 'font-medium'}`}>{it.label}</span>
                        <span className="block text-xs text-muted mt-0.5 truncate">{it.hint}</span>
                      </span>
                      <Icon name="chevR" className="w-[18px] h-[18px] text-brand shrink-0" stroke={2} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <div className={`${GRUPO} border-t border-hairline`}>
          <button type="button" onClick={() => setSalir(true)} className={`${FILA} text-left text-neg`}>
            <Icon name="logout" className="w-[22px] h-[22px] shrink-0" stroke={1.8} />
            <span className="flex-1 text-base font-medium">Cerrar sesión</span>
          </button>
        </div>
      </nav>

      {salir && (
        <ConfirmDialog title="¿Cerrar la sesión en este dispositivo?" confirmLabel="Sí, cerrar sesión" cancelLabel="No" danger
          onConfirm={() => void cerrarSesion()} onCancel={() => setSalir(false)} />
      )}
    </>
  )
}
