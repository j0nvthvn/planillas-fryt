/**
 * Fondo de color con borde diagonal detrás del encabezado (Hoy, Ajustes).
 * Va absoluto con z negativo: el contenedor de la página debe ser
 * `relative isolate`, y la primera tarjeta queda montada encima.
 */
export function Banda({ className = 'h-[176px] md:h-[210px]' }: { className?: string }) {
  return <div aria-hidden="true" className={`saludo-banda absolute -z-10 -top-5 -inset-x-4 sm:-inset-x-6 md:top-0 md:inset-x-0 md:rounded-[24px] ${className}`} />
}
