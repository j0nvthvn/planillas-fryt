import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { ProveedorAvatar } from '@/components/ProveedorAvatar'
import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAccion } from '@/hooks/useAccion'
import { useCatalogo, actualizarProveedor, eliminarProveedor, fusionarProveedores, subirLogo } from '@/features/catalogo/api'
import { normalizar } from '@/features/turno/parecido'
import { etiquetaModo } from '@/features/turno/modo'
import { clp, fechaDiaMes } from '@/lib/format'
import { useComprasProveedor } from './api'

/** Compras que se muestran de una vez; «Ver más» agrega otras tantas. */
const POR_PAGINA = 30

export default function ProveedorDetalle() {
  const { id } = useParams({ from: '/app/proveedores/$id' })
  const navigate = useNavigate()
  const run = useAccion()
  const catalogo = useCatalogo()
  const prov = catalogo.data?.find((p) => p.id === id)
  const [renombrar, setRenombrar] = useState<string | null>(null)
  const [fusion, setFusion] = useState<{ q: string; destino: string | null } | null>(null)
  const [confirmar, setConfirmar] = useState<'eliminar' | 'fusionar' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mostradas, setMostradas] = useState(POR_PAGINA)

  const compras = useComprasProveedor(id)
  const lista = compras.data?.compras ?? []
  const candidatos = useMemo(() => {
    const n = normalizar(fusion?.q ?? '')
    return (catalogo.data ?? []).filter((p) => p.id !== id && (!n || normalizar(p.nombre).includes(n))).slice(0, 8)
  }, [catalogo.data, fusion?.q, id])

  async function correr(fn: () => Promise<void>, ok: string) {
    setOcupado(true)
    await run(fn, ok)
    setOcupado(false)
    setConfirmar(null)
  }

  if (catalogo.isPending) return <Spinner />
  if (!prov) return <div className="text-center py-10 text-muted">Proveedor no encontrado. <Link to="/proveedores" className="underline">Volver</Link></div>

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader eyebrow="Proveedor" title={prov.nombre} back="/proveedores" volverAtras />
      <div className="card flex items-center gap-4 mb-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="Cambiar logo">
          <ProveedorAvatar nombre={prov.nombre} imagenUrl={prov.imagen_url} size="lg" />
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-[9px] bg-brand text-on-solid grid place-items-center border-2 border-card"><Icon name="camera" className="w-3.5 h-3.5" /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void correr(async () => { await subirLogo(prov.id, prov.nombre, f) }, 'Logo actualizado')
          e.target.value = ''
        }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted tabular-nums">
            {compras.data ? `${lista.length} ${lista.length === 1 ? 'compra' : 'compras'} · ${clp(compras.data.total)} en total` : compras.isError ? 'No se pudieron cargar las compras' : 'Cargando compras…'}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button type="button" className="hit btn-secondary text-sm min-h-[38px] px-3" onClick={() => setRenombrar(prov.nombre)}><Icon name="pencil" className="w-4 h-4" />Renombrar</button>
            <button type="button" className="hit btn-secondary text-sm min-h-[38px] px-3" onClick={() => setFusion({ q: '', destino: null })}><Icon name="merge" className="w-4 h-4" />Fusionar con…</button>
            <button type="button" className="hit btn-secondary text-sm min-h-[38px] px-3" onClick={() => void correr(() => actualizarProveedor(prov.id, { activo: !prov.activo }), prov.activo ? 'Proveedor desactivado' : 'Proveedor activado')}>
              {prov.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" className="hit btn-ghost text-sm min-h-[38px] px-3 text-neg" onClick={() => setConfirmar('eliminar')}><Icon name="trash" className="w-4 h-4" />Eliminar</button>
          </div>
        </div>
      </div>

      <h2 className="eyebrow mb-[9px]">Compras</h2>
      {compras.isPending ? <Spinner className="py-6" /> : compras.isError ? (
        <div role="alert" className="card text-center py-6">
          <p className="text-sm text-ink2">No pudimos cargar las compras.</p>
          <button type="button" className="btn-secondary mt-3" onClick={() => void compras.refetch()}>Reintentar</button>
        </div>
      ) : lista.length === 0 ? <p className="text-sm text-muted">Sin compras registradas.</p> : (
        <>
          <div className="card p-0 divide-y divide-hairline overflow-hidden">
            {lista.slice(0, mostradas).map((c) => (
              <Link key={c.id} to="/dia" search={{ fecha: c.fecha }} className="flex items-center gap-3 px-4 py-2.5 min-h-[56px] hover:bg-soft/60">
                <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${c.formaPago === 'efectivo' ? 'bg-pos' : 'bg-brand'}`} aria-hidden="true" />
                <span className="flex-1 text-sm text-ink"><span className="capitalize">{fechaDiaMes(c.fecha)}</span> <span className="text-muted text-xs">· {etiquetaModo(c.modo).toLowerCase()} · {c.formaPago}</span></span>
                <span className="cifra text-sm text-neg">{c.monto ? '−' : ''}{clp(c.monto)}</span>
              </Link>
            ))}
          </div>
          {lista.length > mostradas && (
            <button type="button" className="btn-secondary w-full mt-3" onClick={() => setMostradas((n) => n + POR_PAGINA)}>
              Ver más compras ({lista.length - mostradas} más)
            </button>
          )}
        </>
      )}

      {renombrar !== null && (
        <BottomSheet title="Renombrar" onClose={() => setRenombrar(null)}>
          <input type="text" className="input" value={renombrar} autoFocus onChange={(e) => setRenombrar(e.target.value)} aria-label="Nuevo nombre" />
          <p className="text-xs text-muted">El nombre nuevo se propaga a todas las compras registradas.</p>
          <button type="button" className="btn-primary btn-lg w-full" disabled={!renombrar.trim() || ocupado}
            onClick={() => void correr(async () => { await actualizarProveedor(prov.id, { nombre: renombrar.trim() }); setRenombrar(null) }, 'Nombre actualizado')}>Guardar</button>
        </BottomSheet>
      )}
      {fusion && (
        <BottomSheet title={`Fusionar “${prov.nombre}” con…`} onClose={() => setFusion(null)}>
          <p className="text-xs text-muted">Todas las compras de este proveedor pasan al que elijas y este se elimina. El destino hereda el logo si no tenía.</p>
          <input type="search" className="input" placeholder="Buscar destino" value={fusion.q} autoFocus onChange={(e) => setFusion({ q: e.target.value, destino: null })} aria-label="Buscar proveedor destino" />
          <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
            {candidatos.map((c) => (
              <button key={c.id} type="button" aria-pressed={fusion.destino === c.id} onClick={() => setFusion({ ...fusion, destino: c.id })}
                className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-left border transition-colors ${fusion.destino === c.id ? 'bg-brand-tint border-brand/40 text-brand' : 'bg-card border-hairline-strong text-ink hover:bg-soft'}`}>
                <ProveedorAvatar nombre={c.nombre} imagenUrl={c.imagen_url} size="sm" /><span className="flex-1 text-base font-medium">{c.nombre}</span><span className="text-xs text-muted tabular-nums">{c.usos} usos</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary btn-lg w-full" disabled={!fusion.destino} onClick={() => setConfirmar('fusionar')}>Fusionar</button>
        </BottomSheet>
      )}
      {confirmar === 'eliminar' && (
        <ConfirmDialog title="¿Eliminar del catálogo?" message="Las compras ya registradas conservan el nombre, pero quedan sin proveedor asociado. Si es un duplicado, mejor fusiónalo." danger confirmLabel="Eliminar" loading={ocupado}
          onCancel={() => setConfirmar(null)} onConfirm={() => void correr(async () => { await eliminarProveedor(prov.id); void navigate({ to: '/proveedores' }) }, 'Proveedor eliminado')} />
      )}
      {confirmar === 'fusionar' && fusion?.destino && (
        <ConfirmDialog title="¿Confirmar fusión?" message={`“${prov.nombre}” desaparece y sus compras pasan a “${catalogo.data?.find((c) => c.id === fusion.destino)?.nombre}”.`} confirmLabel="Fusionar" loading={ocupado}
          onCancel={() => setConfirmar(null)} onConfirm={() => void correr(async () => { await fusionarProveedores(prov.id, fusion.destino!); void navigate({ to: '/proveedores/$id', params: { id: fusion.destino! } }) }, 'Proveedores fusionados')} />
      )}
    </div>
  )
}
