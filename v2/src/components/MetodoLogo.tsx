import { useState } from 'react'
import type { MetodoPago } from '@/features/catalogo/api'
import { colorMetodo } from '@/lib/theme'

const FALLBACK: Record<string, string> = {
  efectivo: 'M3 7h18v10H3zM12 9.7a2.3 2.3 0 100 4.6',
  getnet: 'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM2 10h20',
  mercadopago: 'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM7 12h6M7 15h4',
  edenred: 'M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8zM9 8v8',
  amipass: 'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM7 12l2 2 4-4',
  transferencia: 'M4 10l8-5 8 5M5 10v7M19 10v7M9 10v7M15 10v7M3 19h18',
}
const GENERICO = 'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z'

const SIZES = {
  sm: { box: 'w-9 h-9 rounded-[9px]', img: 'w-[26px] h-[26px]', icon: 'w-[17px] h-[17px]' },
  md: { box: 'w-10 h-10 rounded-[10px]', img: 'w-[30px] h-[30px]', icon: 'w-[19px] h-[19px]' },
}

export function MetodoLogo({ metodo, size = 'md', className = '' }: { metodo: Pick<MetodoPago, 'key' | 'label' | 'logo' | 'color'>; size?: keyof typeof SIZES; className?: string }) {
  const [imgError, setImgError] = useState(false)
  // Otro logo: se vuelve a intentar la imagen (ajuste durante el render, que
  // es más barato que un efecto que re-renderiza).
  const [logoVisto, setLogoVisto] = useState(metodo.logo)
  if (logoVisto !== metodo.logo) { setLogoVisto(metodo.logo); setImgError(false) }
  const sz = SIZES[size]
  const showImg = !!metodo.logo && !imgError
  return (
    // Los logos son PNG pensados para fondo claro: en oscuro la caja sigue clara.
    <span className={`shrink-0 grid place-items-center border border-hairline ${showImg ? 'bg-card dark:bg-[#F3F4F6]' : 'bg-card'} ${sz.box} ${className}`}>
      {showImg ? (
        <img src={metodo.logo ?? ''} alt="" className={`${sz.img} object-contain`} onError={() => setImgError(true)} />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className={sz.icon} style={{ stroke: colorMetodo(metodo.color) }} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={FALLBACK[metodo.key] ?? GENERICO} />
        </svg>
      )}
    </span>
  )
}
