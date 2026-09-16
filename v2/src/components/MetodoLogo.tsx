import { useEffect, useState } from 'react'
import type { MetodoPago } from '@/features/catalogo/api'

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
  sm: { box: 'w-8 h-8 rounded-lg', img: 'w-6 h-6', icon: 'w-4 h-4' },
  md: { box: 'w-11 h-11 rounded-xl', img: 'w-9 h-9', icon: 'w-5 h-5' },
}

export function MetodoLogo({ metodo, size = 'md', active = false }: { metodo: Pick<MetodoPago, 'key' | 'label' | 'logo' | 'color'>; size?: keyof typeof SIZES; active?: boolean }) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [metodo.logo])
  const sz = SIZES[size]
  const showImg = !!metodo.logo && !imgError
  return (
    <span className={`relative shrink-0 flex items-center justify-center bg-image-bg ${sz.box}`}>
      {showImg ? (
        <img src={metodo.logo ?? ''} alt="" className={`${sz.img} object-contain`} onError={() => setImgError(true)} />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className={sz.icon} stroke={metodo.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={FALLBACK[metodo.key] ?? GENERICO} />
        </svg>
      )}
      {active && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card bg-pos" />}
    </span>
  )
}
