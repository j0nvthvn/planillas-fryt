import { useMemo, useState } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import Icon from '@/components/Icon'
import { ProveedorAvatar } from '@/components/ProveedorAvatar'
import { AmountDisplay, DesktopAmountInput, Keypad, PayToggle, applyKey, digitosANumero, numeroADigitos } from '@/components/Keypad'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useCatalogo, type Proveedor } from '@/features/catalogo/api'
import type { LineaForm } from './useTurnoForm'
import { nuevaKey } from './useTurnoForm'
import { normalizar, proveedorParecido } from './parecido'
import type { FormaPago } from '@/lib/totales'

interface Props {
  linea: LineaForm | null
  usados: string[]
  onSave: (l: LineaForm) => void
  onDelete?: (key: string) => void
  onClose: () => void
}

export function ProveedorSheet({ linea, usados, onSave, onDelete, onClose }: Props) {
  const desktop = useIsDesktop()
  const catalogo = useCatalogo()
  const [query, setQuery] = useState(linea?.nombre ?? '')
  const [elegido, setElegido] = useState<Pick<Proveedor, 'id' | 'nombre' | 'imagen_url'> | null>(
    linea?.proveedor_id ? { id: linea.proveedor_id, nombre: linea.nombre, imagen_url: null } : null,
  )
  const [digits, setDigits] = useState(() => numeroADigitos(linea?.monto ?? null))
  const [forma, setForma] = useState<FormaPago>(linea?.forma_pago ?? 'efectivo')

  const q = normalizar(query)
  const sugerencias = useMemo(() => {
    const lista = (catalogo.data ?? []).filter((p) => p.activo)
    const filtrada = q ? lista.filter((p) => normalizar(p.nombre).includes(q)) : lista
    return [...filtrada].sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre)).slice(0, q ? 12 : 8)
  }, [catalogo.data, q])
  const exacto = sugerencias.find((p) => normalizar(p.nombre) === q)
  // Antes de crear uno nuevo: ¿no será el mismo escrito distinto? (así
  // aparecieron "Río Maipo" y "Rio Maipo" en producción).
  const parecido = useMemo(
    () => (exacto || elegido ? null : proveedorParecido(q, (catalogo.data ?? []).filter((p) => p.activo))),
    [catalogo.data, q, exacto, elegido],
  )
  const nombreFinal = (elegido?.nombre ?? exacto?.nombre ?? query).trim()
  const monto = digitosANumero(digits)
  const color = forma === 'efectivo' ? 'var(--pos)' : 'var(--info)'
  const puede = nombreFinal.length > 0 && monto > 0

  function elegir(p: Pick<Proveedor, 'id' | 'nombre' | 'imagen_url'>) {
    setElegido(p)
    setQuery(p.nombre)
  }

  function guardar() {
    if (!puede) return
    const prov = elegido ?? exacto ?? null
    onSave({
      key: linea?.key ?? nuevaKey(),
      id: linea?.id ?? null,
      proveedor_id: prov?.id ?? null,
      nombre: prov?.nombre ?? nombreFinal,
      monto,
      forma_pago: forma,
    })
  }

  return (
    <BottomSheet
      title={linea ? 'Editar proveedor' : 'Agregar proveedor'}
      onClose={onClose}
      extra={linea && onDelete ? (
        <button type="button" onClick={() => onDelete(linea.key)} className="hit w-[34px] h-[34px] rounded-[10px] grid place-items-center bg-neg-tint text-neg" aria-label="Quitar proveedor">
          <Icon name="trash" className="w-4 h-4" />
        </button>
      ) : undefined}
    >
      <div className="relative">
        <Icon name="search" className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
        <input
          type="text" value={query} autoFocus={!linea}
          onChange={(e) => { setQuery(e.target.value); setElegido(null) }}
          placeholder="Buscar o escribir proveedor"
          aria-label="Nombre del proveedor"
          className="input pl-10"
          autoComplete="off" autoCapitalize="words"
        />
      </div>

      {sugerencias.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 md:flex-wrap md:overflow-visible md:mx-0 md:px-0" role="group" aria-label="Proveedores frecuentes">
          {sugerencias.map((p) => {
            const on = elegido?.id === p.id || (!elegido && exacto?.id === p.id)
            const usado = usados.includes(p.id)
            return (
              <button key={p.id} type="button" aria-pressed={on} onClick={() => elegir(p)}
                className={`shrink-0 flex items-center gap-2 rounded-[12px] pl-1.5 pr-3 py-1.5 text-sm font-medium border whitespace-nowrap transition-colors ${on ? 'bg-brand-tint text-brand border-brand/40' : 'bg-card text-ink2 border-hairline-strong'}`}>
                <ProveedorAvatar nombre={p.nombre} imagenUrl={p.imagen_url} size="sm" />
                {p.nombre}
                {usado && <><Icon name="check" className="w-3 h-3 text-pos" stroke={2.6} /><span className="sr-only">, ya agregado en este turno</span></>}
              </button>
            )
          })}
        </div>
      )}
      {/* Sugerencias que aparecen mientras se escribe: se anuncian. */}
      <div aria-live="polite" className="contents">
      {parecido && (
        <div className="flex items-center gap-2 rounded-[12px] bg-warn-tint border border-hairline px-3 py-2 -mt-1">
          <Icon name="info" className="w-[18px] h-[18px] shrink-0 text-warn" />
          <span className="flex-1 min-w-0 text-sm font-medium text-warn">¿Quisiste decir <b>{parecido.nombre}</b>?</span>
          <button type="button" onClick={() => elegir(parecido)} className="hit btn-secondary min-h-[36px] px-3 text-sm shrink-0">Usar ese</button>
        </div>
      )}
      {q && !exacto && !elegido && (
        <p className="text-xs text-muted -mt-1">Se creará “{query.trim()}” como proveedor nuevo.</p>
      )}
      </div>

      {desktop ? (
        <DesktopAmountInput digits={digits} onChange={setDigits} onEnter={guardar} color={color} label="Monto" nombre="Monto pagado" autoFocus={!!linea} />
      ) : (
        <AmountDisplay digits={digits} sub="Monto" color={color} nombre="Monto pagado" />
      )}
      <PayToggle value={forma} onChange={setForma} />
      {desktop ? (
        <button type="button" className="btn-primary w-full" disabled={!puede} onClick={guardar}>{linea ? 'Guardar cambios' : 'Agregar'}</button>
      ) : (
        <Keypad onKey={(k) => setDigits((d) => applyKey(d, k))} onAccept={guardar} disabled={!puede} label={linea ? 'Guardar cambios' : 'Agregar proveedor'} />
      )}
    </BottomSheet>
  )
}
