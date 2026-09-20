import { DeltaBadge } from 'frytcontrol'

/** Variación contra el período anterior: sube, baja, igual o nuevo. */
export const Variaciones = () => (
  <div className="flex flex-wrap items-center gap-3 p-4 bg-card">
    <DeltaBadge actual={1_284_500} anterior={1_090_000} />
    <DeltaBadge actual={742_000} anterior={905_300} />
    <DeltaBadge actual={640_000} anterior={640_000} />
    <DeltaBadge actual={318_900} anterior={0} />
  </div>
)

/** Con fondo (`fondo`), para cuando la insignia va suelta sobre la tarjeta. */
export const ConFondo = () => (
  <div className="flex flex-wrap items-center gap-3 p-4 bg-card">
    <DeltaBadge actual={1_284_500} anterior={1_090_000} fondo />
    <DeltaBadge actual={742_000} anterior={905_300} fondo />
    <DeltaBadge actual={640_000} anterior={640_000} fondo />
    <DeltaBadge actual={318_900} anterior={0} fondo />
  </div>
)

/** Si la cifra cambia de signo el % engaña: se muestra la diferencia en pesos. */
export const CambioDeSigno = () => (
  <div className="flex flex-wrap items-center gap-3 p-4 bg-card">
    <DeltaBadge actual={82_400} anterior={-31_000} fondo />
    <DeltaBadge actual={-18_600} anterior={45_200} fondo />
  </div>
)

/** `menosEsMejor`: en gastos, bajar es la buena noticia (verde). */
export const MenosEsMejor = () => (
  <div className="flex flex-wrap items-center gap-3 p-4 bg-card">
    <DeltaBadge actual={212_000} anterior={318_000} menosEsMejor fondo />
    <DeltaBadge actual={402_000} anterior={318_000} menosEsMejor fondo />
  </div>
)

/** En su sitio: junto a la cifra del período, en una tarjeta de Análisis. */
export const EnContexto = () => (
  <div className="card p-4 max-w-xs">
    <p className="eyebrow mb-[5px]">Ventas de la semana</p>
    <div className="flex items-baseline gap-2">
      <p className="amount text-2xl text-ink">$1.284.500</p>
      <DeltaBadge actual={1_284_500} anterior={1_090_000} />
    </div>
  </div>
)
