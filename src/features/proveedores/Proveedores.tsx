import { useMemo, useState } from 'react'
import { AvisoAmbar } from '@/components/Aviso'
import { Link, useNavigate } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { ProveedorAvatar } from '@/components/ProveedorAvatar'
import { BottomSheet } from '@/components/BottomSheet'
import { useAccion } from '@/hooks/useAccion'
import { useCatalogo, crearProveedor } from '@/features/catalogo/api'
import { normalizar } from '@/features/turno/parecido'

export default function Proveedores() {
  const catalogo = useCatalogo()
  const navigate = useNavigate()
  const run = useAccion()
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

  const activos = (catalogo.data ?? []).filter((p) => p.activo).length

  async function crear() {
    if (!nuevo?.trim()) return
    setCreando(true)
    await run(async () => {
      const p = await crearProveedor(nuevo)
      setNuevo(null)
      void navigate({ to: '/proveedores/$id', params: { id: p.id } })
    })
    setCreando(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow={`Catálogo · ${activos} activo${activos === 1 ? '' : 's'}`} title="Proveedores" action={<button type="button" className="btn-primary btn-bar" onClick={() => setNuevo('')}><Icon name="plus" className="w-4 h-4" stroke={2.2} />Nuevo</button>} />
      <div className="relative mb-2">
        <Icon name="search" className="w-[17px] h-[17px] absolute left-[13px] top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" className="input min-h-[44px] py-2.5 pl-10" placeholder="Buscar proveedor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar proveedor" />
      </div>
      <label className="flex items-center gap-2.5 min-h-[44px] text-sm text-ink2 mb-1"><input type="checkbox" className="w-5 h-5 shrink-0 accent-brand" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />Mostrar inactivos</label>

      {sospechosos.length > 0 && !q && (
        <AvisoAmbar titulo="Posibles duplicados" className="mb-3">
            <ul className="mt-1 space-y-0.5 text-xs text-ink2">{sospechosos.slice(0, 6).map((g) => <li key={g.join('|')}>{g.join(' · ')}</li>)}</ul>
            <p className="mt-1.5 text-xs font-semibold text-warn">Ábrelos y usa “Fusionar con…” para unificarlos.</p>
        </AvisoAmbar>
      )}

      {catalogo.isPending ? <Spinner /> : (
        <div className="card p-0 divide-y divide-hairline overflow-hidden">
          {lista.map((p) => (
            <Link key={p.id} to="/proveedores/$id" params={{ id: p.id }} className="row py-2.5 hover:bg-soft/60">
              {/* Inactivo: se atenúa solo el avatar; el texto dice «inactivo» y conserva el contraste. */}
              <span className={p.activo ? 'contents' : 'shrink-0 opacity-55'}><ProveedorAvatar nombre={p.nombre} imagenUrl={p.imagen_url} /></span>
              <span className="flex-1 min-w-0"><span className="block text-base font-medium text-ink truncate">{p.nombre}</span><span className="block text-xs text-muted mt-0.5">{p.usos ? `${p.usos} compra${p.usos === 1 ? '' : 's'} recientes` : 'Sin compras recientes'}{p.activo ? '' : ' · inactivo'}</span></span>
              <Icon name="chevR" className="w-[15px] h-[15px] text-muted2 shrink-0" />
            </Link>
          ))}
          {lista.length === 0 && <p className="text-center text-muted py-8 text-sm">Sin resultados.</p>}
        </div>
      )}

      {nuevo !== null && (
        <BottomSheet title="Nuevo proveedor" onClose={() => setNuevo(null)}>
          <input type="text" className="input" placeholder="Nombre" value={nuevo} autoFocus onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void crear()} aria-label="Nombre del proveedor" />
          <button type="button" className="btn-primary btn-lg w-full" disabled={!nuevo.trim() || creando} onClick={() => void crear()}>{creando ? 'Creando…' : 'Crear'}</button>
        </BottomSheet>
      )}
    </div>
  )
}
