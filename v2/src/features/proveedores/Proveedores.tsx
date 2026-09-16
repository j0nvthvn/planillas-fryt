import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { ProveedorAvatar } from '@/components/ProveedorAvatar'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/Toast'
import { useCatalogo, crearProveedor } from '@/features/catalogo/api'
import { normalizar } from '@/features/turno/parecido'
import { mensajeDeError } from '@/lib/errorLog'

export default function Proveedores() {
  const catalogo = useCatalogo()
  const navigate = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [nuevo, setNuevo] = useState<string | null>(null)
  const [verInactivos, setVerInactivos] = useState(false)
  const [creando, setCreando] = useState(false)

  const lista = useMemo(() => {
    const n = normalizar(q)
    return (catalogo.data ?? [])
      .filter((p) => (verInactivos || p.activo) && (!n || normalizar(p.nombre).includes(n)))
      .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre))
  }, [catalogo.data, q, verInactivos])

  // Posibles duplicados: mismo nombre normalizado salvo espacios/artículos comunes.
  const sospechosos = useMemo(() => {
    const grupos = new Map<string, string[]>()
    for (const p of catalogo.data ?? []) {
      const k = normalizar(p.nombre).replace(/^(distribuidora|comercial|el|la|los|las)/, '').replace(/(spa|ltda|sa)$/, '')
      if (k.length < 3) continue
      grupos.set(k, [...(grupos.get(k) ?? []), p.nombre])
    }
    return [...grupos.values()].filter((g) => g.length > 1)
  }, [catalogo.data])

  async function crear() {
    if (!nuevo?.trim()) return
    setCreando(true)
    try {
      const p = await crearProveedor(nuevo)
      setNuevo(null)
      void navigate({ to: '/proveedores/$id', params: { id: p.id } })
    } catch (e) { toast.error(mensajeDeError(e)) } finally { setCreando(false) }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="Catálogo" title="Proveedores" action={<button type="button" className="btn-primary px-3" onClick={() => setNuevo('')}><Icon name="plus" className="w-5 h-5" stroke={2.2} />Nuevo</button>} />
      <div className="relative mb-3">
        <Icon name="search" className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
        <input type="search" className="input pl-10" placeholder="Buscar proveedor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar proveedor" />
      </div>
      <label className="flex items-center gap-2 min-h-[40px] text-sm text-ink2 mb-1 px-1"><input type="checkbox" className="w-5 h-5 accent-brand" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />Mostrar inactivos</label>

      {sospechosos.length > 0 && !q && (
        <div className="mb-3 rounded-2xl bg-warn-tint border border-warn/30 px-4 py-3 text-sm text-warn">
          <p className="font-semibold">Posibles duplicados</p>
          <ul className="mt-1 space-y-0.5">{sospechosos.slice(0, 6).map((g) => <li key={g.join('|')}>{g.join(' · ')}</li>)}</ul>
          <p className="mt-1 text-xs">Ábrelos y usa “Fusionar con…” para unificarlos.</p>
        </div>
      )}

      {catalogo.isPending ? <Spinner /> : (
        <div className="card p-0 divide-y divide-hairline overflow-hidden">
          {lista.map((p) => (
            <Link key={p.id} to="/proveedores/$id" params={{ id: p.id }} className={`flex items-center gap-3 px-4 py-3 min-h-[60px] hover:bg-soft/60 ${p.activo ? '' : 'opacity-55'}`}>
              <ProveedorAvatar nombre={p.nombre} imagenUrl={p.imagen_url} />
              <span className="flex-1 min-w-0"><span className="block text-base font-medium text-ink truncate">{p.nombre}</span><span className="block text-xs text-muted">{p.usos ? `${p.usos} compra${p.usos === 1 ? '' : 's'} recientes` : 'Sin compras recientes'}{p.activo ? '' : ' · inactivo'}</span></span>
              <Icon name="chevR" className="w-4 h-4 text-muted2" />
            </Link>
          ))}
          {lista.length === 0 && <p className="text-center text-muted py-8 text-sm">Sin resultados.</p>}
        </div>
      )}

      {nuevo !== null && (
        <BottomSheet title="Nuevo proveedor" onClose={() => setNuevo(null)}>
          <input type="text" className="input" placeholder="Nombre" value={nuevo} autoFocus onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void crear()} aria-label="Nombre del proveedor" />
          <button type="button" className="btn-primary w-full" disabled={!nuevo.trim() || creando} onClick={() => void crear()}>{creando ? 'Creando…' : 'Crear'}</button>
        </BottomSheet>
      )}
    </div>
  )
}
