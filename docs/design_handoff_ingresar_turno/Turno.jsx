import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { clp, hoy, fechaLegible, parseNum } from '../utils/format'

/* ============================================================
   Ingresar turno — Enfoque A (Lista + hoja inferior)
   Reescritura de la UI conservando toda la lógica de Supabase.
   - Proveedores se agregan de a uno desde una hoja inferior
     con buscador de frecuentes + teclado tipo calculadora.
   - Ventas por método (incluye Mercado Pago) en filas tocables.
   - Total siempre visible en la barra inferior.
   ============================================================ */

// Acento de marca (Ciruela). Centralízalo en tailwind.config si prefieres.
const ACCENT = '#7A4F86'
const ACCENT_TINT = '#EFE6F2'
const GREEN = '#1E7A4F'   // efectivo
const NAVY = '#33518C'    // transferencia

const METODOS_VENTA = [
  { key: 'efectivo', label: 'Efectivo', sub: 'Caja' },
  { key: 'getnet', label: 'Getnet', sub: 'Débito / Crédito' },
  { key: 'mercadopago', label: 'Mercado Pago', sub: 'Débito / Crédito' },
  { key: 'edenred', label: 'Edenred', sub: 'Amipass / Sodexo' },
  { key: 'transferencia', label: 'Transferencia', sub: 'Banco' },
]
const VENTAS_VACIAS = { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, transferencia: 0 }

/* ── Helpers del teclado numérico ─────────────────────────── */
function applyKey(cur, k) {
  let v = String(cur || '')
  if (k === 'del') return v.slice(0, -1)
  if (k === '000') v = v === '' ? '' : v + '000'
  else v = v === '' || v === '0' ? k : v + k
  return v.replace(/^0+(?=\d)/, '').slice(0, 9)
}

/* ── Iconos (stroke, sobrios) ─────────────────────────────── */
function Icon({ name, className = 'w-5 h-5', stroke = 1.7 }) {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    check: 'M4 12.5l5 5L20 6.5',
    trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
    chevR: 'M9 5l7 7-7 7',
    close: 'M6 6l12 12M18 6L6 18',
    store: 'M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16',
    cash: 'M3 7h18v10H3zM12 9.7a2.3 2.3 0 100 4.6 2.3 2.3 0 000-4.6',
    bank: 'M4 10l8-5 8 5M5 10v7M19 10v7M9 10v7M15 10v7M3 19h18',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5',
    moon: 'M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z',
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

export default function Turno() {
  const { usuario } = useAuth()
  const [tipo, setTipo] = useState('mañana')
  const [provs, setProvs] = useState([])          // [{ nombre, monto, forma_pago }]
  const [ventas, setVentas] = useState(VENTAS_VACIAS)
  const [sugerencias, setSugerencias] = useState([])
  const [sheet, setSheet] = useState(null)        // null | { mode:'prov', idx, ... } | { mode:'venta', key, monto }
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [turnoExistente, setTurnoExistente] = useState(false)
  const [exito, setExito] = useState(null)

  /* Verificar si ya existe el turno del tipo seleccionado para hoy */
  useEffect(() => {
    let activo = true
    async function verificar() {
      setError(''); setTurnoExistente(false)
      const { data: jornada } = await supabase
        .from('jornadas').select('id').eq('fecha', hoy()).single()
      if (!jornada) return
      const { data: turno } = await supabase
        .from('turnos').select('id').eq('jornada_id', jornada.id).eq('tipo', tipo).single()
      if (activo && turno) setTurnoExistente(true)
    }
    verificar()
    return () => { activo = false }
  }, [tipo])

  /* Cargar sugerencias de proveedores frecuentes */
  useEffect(() => {
    supabase.from('proveedores_frecuentes').select('nombre').order('nombre')
      .then(({ data }) => { if (data) setSugerencias(data.map((p) => p.nombre)) })
  }, [])

  /* Totales en tiempo real */
  const efProv = useMemo(() => provs.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + p.monto, 0), [provs])
  const trProv = useMemo(() => provs.filter((p) => p.forma_pago === 'transferencia').reduce((s, p) => s + p.monto, 0), [provs])
  const totalVentas = useMemo(() => METODOS_VENTA.reduce((s, m) => s + (ventas[m.key] || 0), 0), [ventas])

  const usedNames = provs.map((p) => p.nombre)

  /* ── Acciones de la hoja ── */
  function openNew() { setSheet({ mode: 'prov', idx: -1, nombre: '', monto: '', forma_pago: 'efectivo' }) }
  function openEdit(i) { setSheet({ mode: 'prov', idx: i, nombre: provs[i].nombre, monto: String(provs[i].monto), forma_pago: provs[i].forma_pago }) }
  function openVenta(key) { setSheet({ mode: 'venta', key, monto: ventas[key] ? String(ventas[key]) : '' }) }

  function commitProv() {
    const row = { nombre: sheet.nombre.trim() || 'Proveedor', monto: parseNum(sheet.monto), forma_pago: sheet.forma_pago }
    if (sheet.idx === -1) setProvs((p) => [...p, row])
    else setProvs((p) => p.map((x, i) => (i === sheet.idx ? row : x)))
    setSheet(null)
  }
  function commitVenta() {
    setVentas((v) => ({ ...v, [sheet.key]: parseNum(sheet.monto) }))
    setSheet(null)
  }
  function delProv(i) { setProvs((p) => p.filter((_, j) => j !== i)); setSheet(null) }

  /* ── Guardar (lógica original conservada) ── */
  async function guardarTurno() {
    if (turnoExistente) { setError(`Ya existe el turno de ${tipo} para hoy.`); return }

    const proveedoresValidos = provs.filter((p) => p.nombre.trim() && p.monto > 0)
    if (proveedoresValidos.length === 0 && totalVentas === 0) {
      if (!window.confirm('No ingresaste proveedores ni ventas. ¿Deseas guardar el turno vacío?')) return
    }

    setGuardando(true); setError('')
    try {
      // 1. Obtener o crear jornada
      let jornadaId
      const { data: jornadaExistente } = await supabase
        .from('jornadas').select('id').eq('fecha', hoy()).single()
      if (jornadaExistente) jornadaId = jornadaExistente.id
      else {
        const { data: nueva, error: e } = await supabase
          .from('jornadas').insert({ fecha: hoy() }).select('id').single()
        if (e) throw e
        jornadaId = nueva.id
      }

      // 2. Crear turno
      const { data: turno, error: errTurno } = await supabase
        .from('turnos').insert({ jornada_id: jornadaId, tipo, usuario_id: usuario.id }).select('id').single()
      if (errTurno) throw errTurno

      // 3. Proveedores válidos + upsert de frecuentes
      if (proveedoresValidos.length > 0) {
        const rows = proveedoresValidos.map((p) => ({
          turno_id: turno.id, nombre: p.nombre.trim(), monto: p.monto, forma_pago: p.forma_pago,
        }))
        const { error: errProv } = await supabase.from('proveedores_turno').insert(rows)
        if (errProv) throw errProv
        await supabase.from('proveedores_frecuentes')
          .upsert(proveedoresValidos.map((p) => ({ nombre: p.nombre.trim() })), { onConflict: 'nombre', ignoreDuplicates: true })
      }

      // 4. Ventas (incluye mercadopago)
      const { error: errVentas } = await supabase.from('ventas_turno').insert({
        turno_id: turno.id,
        efectivo: ventas.efectivo, getnet: ventas.getnet, mercadopago: ventas.mercadopago,
        edenred: ventas.edenred, transferencia: ventas.transferencia,
      })
      if (errVentas) throw errVentas

      setExito({ tipo, totalVentas, efProv, trProv, provs: proveedoresValidos })
    } catch (err) {
      console.error(err)
      setError(err?.code === '23505' ? `Ya existe el turno de ${tipo} para hoy.` : 'Error al guardar el turno. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function reset() {
    setExito(null); setProvs([]); setVentas(VENTAS_VACIAS)
  }

  /* ── Pantalla de éxito ── */
  if (exito) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto space-y-5 py-4">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full grid place-items-center" style={{ background: ACCENT_TINT, color: ACCENT }}>
              <Icon name="check" className="w-8 h-8" stroke={2.6} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Turno guardado</h2>
            <p className="text-sm text-gray-500 capitalize">{exito.tipo} · {fechaLegible(hoy())}</p>
          </div>
          <div className="card divide-y divide-gray-100">
            <Resumen label="Ventas del turno" valor={clp(exito.totalVentas)} />
            <Resumen label="Efectivo a proveedores" valor={clp(exito.efProv)} color={GREEN} />
            <Resumen label="Transferencia a proveedores" valor={clp(exito.trProv)} color={NAVY} />
          </div>
          {exito.provs.length > 0 && (
            <div className="card">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{exito.provs.length} proveedores</p>
              <div className="divide-y divide-gray-100">
                {exito.provs.map((p, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-gray-800">{p.nombre}</span>
                    <span className="font-semibold tabular-nums" style={{ color: p.forma_pago === 'efectivo' ? GREEN : NAVY }}>{clp(p.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={reset} className="btn-secondary w-full py-3">Ingresar otro turno</button>
        </div>
      </Layout>
    )
  }

  /* ── Pantalla principal ── */
  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Encabezado + selector de turno */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1 capitalize">{fechaLegible(hoy())}</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Ingresar turno</h1>
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            {[['mañana', 'sun'], ['tarde', 'moon']].map(([t, ic]) => (
              <button key={t} onClick={() => setTipo(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium capitalize transition ${tipo === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                <Icon name={ic} className="w-4 h-4" />{t}
              </button>
            ))}
          </div>
          {turnoExistente && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Ya existe el turno de {tipo} para hoy.
            </p>
          )}
        </div>

        {/* Proveedores */}
        <section>
          <SectionHead title="Proveedores" right={provs.length || null} />
          {provs.length === 0 ? (
            <button onClick={openNew}
              className="w-full flex flex-col items-center gap-2 py-7 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium">
              <Icon name="plus" /> Agrega el primer proveedor
            </button>
          ) : (
            <>
              <div className="card !p-0 overflow-hidden divide-y divide-gray-100">
                {provs.map((p, i) => (
                  <button key={i} onClick={() => openEdit(i)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.forma_pago === 'efectivo' ? GREEN : NAVY }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium text-gray-900 truncate">{p.nombre}</span>
                      <span className="block text-xs text-gray-500 capitalize">{p.forma_pago}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900">{clp(p.monto)}</span>
                    <Icon name="chevR" className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
              <button onClick={openNew}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: ACCENT_TINT, color: ACCENT }}>
                <Icon name="plus" className="w-4 h-4" stroke={2} /> Agregar proveedor
              </button>
            </>
          )}
        </section>

        {/* Ventas */}
        <section>
          <SectionHead title="Ventas del turno" />
          <div className="card !p-0 overflow-hidden divide-y divide-gray-100">
            {METODOS_VENTA.map((m) => (
              <button key={m.key} onClick={() => openVenta(m.key)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-gray-900">{m.label}</span>
                  <span className="block text-xs text-gray-500">{m.sub}</span>
                </span>
                <span className={`font-semibold tabular-nums ${ventas[m.key] ? 'text-gray-900' : 'text-gray-300'}`}>{clp(ventas[m.key])}</span>
                <Icon name="chevR" className="w-4 h-4 text-gray-300" />
              </button>
            ))}
          </div>
        </section>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
      </div>

      {/* Barra inferior fija con total + guardar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 z-30">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500">Total ventas del turno</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">{clp(totalVentas)}</p>
        </div>
        <button onClick={guardarTurno} disabled={guardando || turnoExistente}
          className="h-12 px-7 rounded-xl text-white font-semibold disabled:opacity-50"
          style={{ background: ACCENT }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      <div className="h-20" />{/* espaciador para la barra fija */}

      {/* Hoja inferior */}
      {sheet && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSheet(null)} />}
      {sheet?.mode === 'prov' && (
        <BottomSheet
          title={sheet.idx === -1 ? 'Agregar proveedor' : 'Editar proveedor'}
          onClose={() => setSheet(null)}
          extra={sheet.idx !== -1 && (
            <button onClick={() => delProv(sheet.idx)} className="w-8 h-8 rounded-full grid place-items-center bg-red-50 text-red-600">
              <Icon name="trash" className="w-[18px] h-[18px]" />
            </button>
          )}>
          <div className="relative">
            <Icon name="store" className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input value={sheet.nombre} onChange={(e) => setSheet((s) => ({ ...s, nombre: e.target.value }))}
              placeholder="Buscar o escribir proveedor" className="input !pl-10" />
          </div>
          <FreqChips query={sheet.nombre} used={usedNames}
            sugerencias={sugerencias} onPick={(n) => setSheet((s) => ({ ...s, nombre: n }))} />
          <AmountDisplay value={sheet.monto} color={sheet.forma_pago === 'efectivo' ? GREEN : NAVY} />
          <PayToggle value={sheet.forma_pago} onChange={(fp) => setSheet((s) => ({ ...s, forma_pago: fp }))} />
          <Keypad onKey={(k) => setSheet((s) => ({ ...s, monto: applyKey(s.monto, k) }))}
            onAccept={commitProv} disabled={parseNum(sheet.monto) === 0}
            accent={sheet.forma_pago === 'efectivo' ? GREEN : NAVY}
            label={sheet.idx === -1 ? 'Agregar proveedor' : 'Guardar cambios'} />
        </BottomSheet>
      )}
      {sheet?.mode === 'venta' && (
        <BottomSheet title={`Ventas · ${METODOS_VENTA.find((m) => m.key === sheet.key).label}`} onClose={() => setSheet(null)}>
          <AmountDisplay value={sheet.monto} sub={METODOS_VENTA.find((m) => m.key === sheet.key).sub} />
          <Keypad onKey={(k) => setSheet((s) => ({ ...s, monto: applyKey(s.monto, k) }))}
            onAccept={commitVenta} accent={ACCENT} label="Listo" />
        </BottomSheet>
      )}
    </Layout>
  )
}

/* ── Subcomponentes ───────────────────────────────────────── */
function SectionHead({ title, right }) {
  return (
    <div className="flex items-baseline justify-between px-1 mb-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      {right != null && <span className="text-sm font-semibold" style={{ color: ACCENT }}>{right}</span>}
    </div>
  )
}

function Resumen({ label, valor, color = '#111827' }) {
  return (
    <div className="flex justify-between py-2.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color }}>{valor}</span>
    </div>
  )
}

function BottomSheet({ title, children, onClose, extra }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl px-4 pt-3 pb-8 shadow-2xl max-h-[92%] flex flex-col gap-3"
      style={{ animation: 'sheetUp .26s cubic-bezier(.2,.8,.2,1)' }}>
      <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div className="w-9 h-1 rounded-full bg-gray-300 mx-auto" />
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] font-bold text-gray-900">{title}</h3>
        <div className="flex gap-2">
          {extra}
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center bg-gray-100 text-gray-600">
            <Icon name="close" className="w-[17px] h-[17px]" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

function FreqChips({ query = '', used = [], sugerencias = [], onPick }) {
  const q = query.trim().toLowerCase()
  const list = (q ? sugerencias.filter((n) => n.toLowerCase().includes(q)) : sugerencias)
  if (list.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      {list.map((n) => {
        const on = used.includes(n)
        return (
          <button key={n} onClick={() => onPick(n)}
            className="shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium border whitespace-nowrap"
            style={on
              ? { background: ACCENT_TINT, color: ACCENT, borderColor: ACCENT }
              : { background: '#fff', color: '#4A4D54', borderColor: 'rgba(22,24,28,.09)' }}>
            {on && <Icon name="check" className="w-3 h-3" stroke={2.4} />}{n}
          </button>
        )
      })}
    </div>
  )
}

function AmountDisplay({ value, sub, color = '#191B1F' }) {
  const n = parseNum(value)
  const empty = !n
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
      {sub && <p className="text-xs font-medium text-gray-500 mb-0.5">{sub}</p>}
      <p className="text-4xl font-semibold tracking-tight tabular-nums" style={{ color: empty ? '#B7B9B2' : color }}>
        {clp(n)}
      </p>
    </div>
  )
}

function PayToggle({ value, onChange }) {
  const opts = [
    { v: 'efectivo', label: 'Efectivo', icon: 'cash', c: GREEN, tint: '#E6F1EA' },
    { v: 'transferencia', label: 'Transferencia', icon: 'bank', c: NAVY, tint: '#E8EDF6' },
  ]
  return (
    <div className="flex gap-2">
      {opts.map((o) => {
        const on = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border"
            style={on ? { background: o.tint, color: o.c, borderColor: o.c } : { background: '#fff', color: '#8C8E88', borderColor: 'rgba(22,24,28,.09)' }}>
            <Icon name={o.icon} className="w-[18px] h-[18px]" stroke={1.8} />{o.label}
          </button>
        )
      })}
    </div>
  )
}

function Keypad({ onKey, onAccept, disabled, accent, label }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '000', '0', 'del']
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button key={k} onClick={() => onKey(k)}
            className="h-12 rounded-2xl border border-gray-100 bg-white text-2xl font-medium text-gray-900 active:bg-gray-50 flex items-center justify-center">
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      <button onClick={onAccept} disabled={disabled}
        className="h-12 rounded-2xl text-white text-base font-semibold flex items-center justify-center gap-2 disabled:bg-gray-300"
        style={!disabled ? { background: accent } : undefined}>
        <Icon name="check" className="w-5 h-5" stroke={2.4} />{label}
      </button>
    </div>
  )
}
