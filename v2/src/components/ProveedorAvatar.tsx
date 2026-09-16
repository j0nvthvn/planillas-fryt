import { useState } from 'react'

const COLORS = ['#8B5D39', '#1E7A4F', '#33518C', '#B45309', '#0F766E', '#BE185D']

export function avatarColor(nombre: string): string {
  let h = 0
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[h % COLORS.length] ?? COLORS[0]!
}

const SIZES = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-16 h-16 text-2xl' }

export function ProveedorAvatar({ nombre = '', imagenUrl, size = 'md' }: { nombre?: string; imagenUrl?: string | null; size?: keyof typeof SIZES }) {
  const [imgError, setImgError] = useState(false)
  // Otra imagen: se vuelve a intentar (ajuste durante el render).
  const [urlVista, setUrlVista] = useState(imagenUrl)
  if (urlVista !== imagenUrl) { setUrlVista(imagenUrl); setImgError(false) }
  const base = `${SIZES[size]} rounded-xl overflow-hidden shrink-0 flex items-center justify-center font-bold text-white`
  if (imagenUrl && !imgError) {
    return (
      <div className={`${base} bg-image-bg`}>
        <img src={imagenUrl} alt="" className="w-full h-full object-contain p-0.5" onError={() => setImgError(true)} />
      </div>
    )
  }
  return <div className={base} style={{ background: avatarColor(nombre || '?') }} aria-hidden="true">{(nombre[0] ?? '?').toUpperCase()}</div>
}
