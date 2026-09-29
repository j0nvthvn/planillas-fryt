import { useMemo, useState } from 'react'
import { AvisoAmbar } from '@/components/Aviso'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { ProveedorAvatar } from '@/components/ProveedorAvatar'
import { BottomSheet } from '@/components/BottomSheet'
import { PILDORA, PILDORA_ON, PILDORA_OFF } from '@/components/pildora'
import { useAccion } from '@/hooks/useAccion'
import { useCatalogo, crearProveedor } from '@/features/catalogo/api'
import { normalizar } from '@/features/turno/parecido'
import { rangoLegible } from '@/features/analisis/rango'
import { ajustarRango, clp, hoy } from '@/lib/format'
import { useComprasPeriodo } from './api'
import { filtrarProveedores, periodo, FILTROS_BASE, PRESET_BASE, type Filtros, type PresetPeriodo } from './filtros'

const PRESETS: { v: PresetPeriodo; label: string }[] = [
  { v: '30', label: '30 días' }, { v: 'mes', label: 'Este mes' }, { v: '90', label: '90 días' }, { v: '365', label: '1 año' },
]
const ESTADOS: { v: Filtros['estado']; label: string }[] = [{ v: 'activos', label: 'Activos' }, { v: 'inactivos', label: 'Inactivos' }, { v: 'todos', label: 'Todos' }]
const USOS: { v: Filtros['uso']; label: string }[] = [{ v: 'con', label: 'Con compras' }, { v: 'sin', label: 'Sin compras' }]
const ORDENES: { v: Filtros['orden']; label: string }[] = [
  { v: 'uso', label: 'Más compras' }, { v: 'monto', label: 'Mayor monto' }, { v: 'az', label: 'A–Z' }, { v: 'nuevos', label: 'Más nuevos' },
]

const esPeriodoBase = (desde: string, hasta: string) => { const b = periodo(PRESET_BASE, hoy()); return b.desde === desde && b.hasta === hasta }

export default function Proveedores() {
  const catalogo = useCatalogo()
  const navigate = useNavigate()
  const run = useAccion()
  const search = useSearch({ from: '/app/proveedores' })
  const [nuevo, setNuevo] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  // Los filtros viven en la URL: al abrir un proveedor y volver, siguen puestos.
  const { q = '', estado = FILTROS_BASE.estado, uso = FILTROS_BASE.uso, orden = FILTROS_BASE.orden } = search
  const filtros: Filtros = useMemo(() => ({ q, estado, uso, orden }), [q, estado, uso, orden])
  const { desde, hasta } = search.desde && search.hasta ? ajustarRango(search.desde, search.hasta) : periodo(PRESET_BASE, hoy())
  const presetActivo = PRESETS.find((p) => { const x = periodo(p.v, hoy()); return x.desde === desde && x.hasta === hasta })?.v
  const hayFiltros = filtros.q !== '' || filtros.estado !== FILTROS_BASE.estado || filtros.uso !== FILTROS_BASE.uso || filtros.orden !== FILTROS_BASE.orden || presetActivo !== PRESET_BASE
  const compras = useComprasPeriodo(desde, hasta)

  /** Un valor igual al de base se quita de la URL, para que quede limpia. */
  function filtrar(cambios: Partial<Filtros & { desde: string; hasta: string }>, replace = false) {
    void navigate({
      to: '/proveedores',
      replace,
      search: (s) => {
        const r = { ...s, ...cambios }
        return {
          q: r.q?.trim() ? r.q : undefined,
          estado: r.estado === FILTROS_BASE.estado ? undefined : r.estado,
          uso: r.uso === FILTROS_BASE.uso ? undefined : r.uso,
          orden: r.orden === FILTROS_BASE.orden ? undefined : r.orden,
          ...(r.desde && r.hasta && !esPeriodoBase(r.desde, r.hasta) ? { desde: r.desde, hasta: r.hasta } : {}),
        }
      },
    })
  }

  const lista = useMemo(() => filtrarProveedores(catalogo.data ?? [], compras.data ?? {}, filtros), [catalogo.data, compras.data, filtros])

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
      <div className="relative mb-2.5">
        <Icon name="search" className="w-[17px] h-[17px] absolute left-[13px] top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" className="input min-h-[44px] py-2.5 pl-10" placeholder="Buscar proveedor" value={filtros.q} onChange={(e) => filtrar({ q: e.target.value }, true)} aria-label="Buscar proveedor" />
      </div>

      {/* Período: las compras y el monto de cada fila, el filtro de uso y el orden se calculan sobre él. */}
      <div className="flex flex-col gap-2.5 mb-2.5 sm:flex-row sm:items-center sm:gap-2">
        <div className="segmented sm:w-auto" role="group" aria-label="Período">
          {PRESETS.map((p) => (
            <button key={p.v} type="button" aria-pressed={presetActivo === p.v} onClick={() => filtrar(periodo(p.v, hoy()))}
              className={`hit ${presetActivo === p.v ? 'segmented-item-on' : 'segmented-item'} min-h-[38px] px-3 whitespace-nowrap`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 w-full text-sm sm:flex sm:w-auto sm:ml-auto">
          <input type="date" aria-label="Desde" className="input py-1.5 px-2.5 min-h-[40px] rounded-[10px] min-w-0 w-full sm:w-[140px]" value={desde} max={hasta} onChange={(e) => e.target.value && filtrar(ajustarRango(e.target.value, hasta, 'desde'))} />
          <span className="text-muted" aria-hidden="true">→</span>
          <input type="date" aria-label="Hasta" className="input py-1.5 px-2.5 min-h-[40px] rounded-[10px] min-w-0 w-full sm:w-[140px]" value={hasta} min={desde} max={hoy()} onChange={(e) => e.target.value && filtrar(ajustarRango(desde, e.target.value, 'hasta'))} />
        </div>
      </div>

      {/* En el celular el borde derecho se desvanece: avisa que hay más filtros al deslizar. */}
      <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 pr-10 pb-2.5 mascara-derecha md:flex-wrap md:mx-0 md:px-0 md:[mask-image:none]">
        <div className="flex gap-1.5" role="group" aria-label="Estado">
          {ESTADOS.map((e) => (
            <button key={e.v} type="button" aria-pressed={filtros.estado === e.v} onClick={() => filtrar({ estado: e.v })}
              className={`${PILDORA} ${filtros.estado === e.v ? PILDORA_ON : PILDORA_OFF}`}>{e.label}</button>
          ))}
        </div>
        <span className="w-px h-5 bg-hairline-strong mx-1 shrink-0" aria-hidden="true" />
        {/* Uso: tocar la píldora encendida la apaga (vuelve a "todos"). */}
        <div className="flex gap-1.5" role="group" aria-label="Compras en el período">
          {USOS.map((u) => (
            <button key={u.v} type="button" aria-pressed={filtros.uso === u.v} onClick={() => filtrar({ uso: filtros.uso === u.v ? 'todos' : u.v })}
              className={`${PILDORA} ${filtros.uso === u.v ? PILDORA_ON : PILDORA_OFF}`}>{u.label}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-xs text-muted" aria-live="polite">
          {catalogo.isPending ? '\u00a0' : `${lista.length} proveedor${lista.length === 1 ? '' : 'es'} · ${rangoLegible(desde, hasta)}`}
          {hayFiltros && <> · <button type="button" className="hit underline text-ink2" onClick={() => void navigate({ to: '/proveedores', search: {} })}>Quitar filtros</button></>}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-muted shrink-0">
          Ordenar
          <select className="input py-1 px-2 min-h-[34px] w-auto text-sm rounded-[9px]" value={filtros.orden} onChange={(e) => filtrar({ orden: e.target.value as Filtros['orden'] })}>
            {ORDENES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {sospechosos.length > 0 && !hayFiltros && (
        <AvisoAmbar titulo="Posibles duplicados" className="mb-3">
            <ul className="mt-1 space-y-0.5 text-xs text-ink2">{sospechosos.slice(0, 6).map((g) => <li key={g.join('|')}>{g.join(' · ')}</li>)}</ul>
            <p className="mt-1.5 text-xs font-semibold text-warn">Ábrelos y usa “Fusionar con…” para unificarlos.</p>
        </AvisoAmbar>
      )}

      {catalogo.isPending || compras.isPending ? <Spinner /> : compras.isError ? (
        <p className="text-center text-muted py-8 text-sm">No se pudieron cargar las compras del período. <button type="button" className="hit underline" onClick={() => void compras.refetch()}>Reintentar</button></p>
      ) : (
        <div className={`card p-0 divide-y divide-hairline overflow-hidden transition-opacity ${compras.isPlaceholderData ? 'opacity-60' : ''}`}>
          {lista.map((p) => (
            <Link key={p.id} to="/proveedores/$id" params={{ id: p.id }} className="row py-2.5 hover:bg-soft/60">
              {/* Inactivo: se atenúa solo el avatar; el texto dice «inactivo» y conserva el contraste. */}
              <span className={p.activo ? 'contents' : 'shrink-0 opacity-55'}><ProveedorAvatar nombre={p.nombre} imagenUrl={p.imagen_url} /></span>
              <span className="flex-1 min-w-0"><span className="block text-base font-medium text-ink truncate">{p.nombre}</span><span className="block text-xs text-muted mt-0.5">{p.compras ? `${p.compras.toLocaleString('es-CL')} compra${p.compras === 1 ? '' : 's'}` : 'Sin compras en el período'}{p.activo ? '' : ' · inactivo'}</span></span>
              {p.compras > 0 && <span className="cifra text-sm text-ink2 shrink-0">{clp(p.monto)}</span>}
              <Icon name="chevR" className="w-[15px] h-[15px] text-muted2 shrink-0" />
            </Link>
          ))}
          {lista.length === 0 && <p className="text-center text-muted py-8 text-sm">Ningún proveedor con estos filtros.</p>}
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
