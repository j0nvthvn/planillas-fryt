import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon, { type IconName } from '@/components/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useTema, type Tema } from '@/lib/theme'
import { cerrarSesion } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { qk, queryClient } from '@/lib/query'
import { mensajeDeError } from '@/lib/errorLog'
import { clp, fechaHora, fechaDiaMes } from '@/lib/format'
import { totalVentas } from '@/lib/totales'
import { useUsuario } from '@/hooks/useUsuario'
import {
  useConfig, useGuardarConfig, useTrabajadores, crearTrabajador, actualizarTrabajador, eliminarTrabajador,
  useMetodos, actualizarMetodo, type Config,
} from '@/features/catalogo/api'
import { usePapelera, restaurarTurno, purgarTurno, etiquetaModo } from '@/features/turno/api'

type Seccion = 'general' | 'trabajadores' | 'metodos' | 'papelera' | 'usuarios' | 'errores'
const SECCIONES: { v: Seccion; label: string; icon: IconName }[] = [
  { v: 'general', label: 'General', icon: 'settings' },
  { v: 'trabajadores', label: 'Trabajadores', icon: 'users' },
  { v: 'metodos', label: 'Métodos de pago', icon: 'wallet' },
  { v: 'papelera', label: 'Papelera', icon: 'trash' },
  { v: 'usuarios', label: 'Cuentas', icon: 'lock' },
  { v: 'errores', label: 'Errores', icon: 'warning' },
]

export default function Ajustes() {
  const { seccion = 'general' } = useSearch({ from: '/app/ajustes' })
  const navigate = useNavigate()
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="FrytControl" title="Ajustes" action={<button type="button" className="btn-secondary px-3" onClick={() => void cerrarSesion()}><Icon name="logout" className="w-[18px] h-[18px]" />Salir</button>} />
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3 md:flex-wrap md:mx-0 md:px-0" role="tablist">
        {SECCIONES.map((s) => (
          <button key={s.v} type="button" role="tab" aria-selected={seccion === s.v} onClick={() => void navigate({ to: '/ajustes', search: { seccion: s.v } })}
            className={`shrink-0 min-h-[38px] rounded-full px-4 text-[13px] font-semibold border flex items-center gap-1.5 ${seccion === s.v ? 'bg-brand text-white border-brand' : 'bg-card text-ink2 border-hairline'}`}>
            <Icon name={s.icon} className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>
      {seccion === 'general' && <General />}
      {seccion === 'trabajadores' && <Trabajadores />}
      {seccion === 'metodos' && <Metodos />}
      {seccion === 'papelera' && <Papelera />}
      {seccion === 'usuarios' && <Usuarios />}
      {seccion === 'errores' && <Errores />}
    </div>
  )
}

function Fila({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[56px]">
      <div><p className="text-[15px] font-medium text-ink">{label}</p>{hint && <p className="text-[12px] text-muted">{hint}</p>}</div>
      {children}
    </div>
  )
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function General() {
  const { config, cargando } = useConfig()
  const guardar = useGuardarConfig()
  const toast = useToast()
  const { tema, setTema } = useTema()
  const [form, setForm] = useState<Config | null>(null)
  const f = form ?? config
  if (cargando) return <Spinner />
  const set = (c: Partial<Config>) => setForm({ ...f, ...c })
  return (
    <div className="space-y-4">
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        <Fila label="Nombre del local"><input className="input w-40 text-right" value={f.nombreLocal} onChange={(e) => set({ nombreLocal: e.target.value })} aria-label="Nombre del local" /></Fila>
        <Fila label="Fondo de caja por defecto" hint="Con lo que parte cada turno"><input className="input w-40 text-right" type="number" inputMode="numeric" min={0} value={f.fondoCajaInicial} onChange={(e) => set({ fondoCajaInicial: Number(e.target.value) || 0 })} aria-label="Fondo de caja" /></Fila>
        <Fila label="Corte de la mañana" hint="Hora en que termina el turno mañana"><input className="input w-24 text-right" type="number" min={0} max={23} value={f.horaCorteManana} onChange={(e) => set({ horaCorteManana: Number(e.target.value) || 0 })} aria-label="Hora de corte" /></Fila>
        <div className="px-4 py-3">
          <p className="text-[15px] font-medium text-ink">Días de un solo turno</p>
          <p className="text-[12px] text-muted mb-2">Esos días se registran siempre como día completo</p>
          <div className="flex gap-1.5 flex-wrap">
            {DIAS.map((d, i) => {
              const on = f.diasTurnoUnico.includes(i)
              return <button key={d} type="button" aria-pressed={on} onClick={() => set({ diasTurnoUnico: on ? f.diasTurnoUnico.filter((x) => x !== i) : [...f.diasTurnoUnico, i].sort() })}
                className={`min-h-[38px] px-3 rounded-full text-[13px] font-semibold border ${on ? 'bg-brand text-white border-brand' : 'bg-card text-ink2 border-hairline'}`}>{d}</button>
            })}
          </div>
        </div>
      </div>
      {form && <button type="button" className="btn-primary w-full" disabled={guardar.isPending} onClick={() => guardar.mutate(form, { onSuccess: () => { setForm(null); toast.ok('Ajustes guardados') }, onError: (e) => toast.error(mensajeDeError(e)) })}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</button>}
      <div className="card p-0 overflow-hidden">
        <Fila label="Apariencia">
          <div className="flex gap-1 p-1 rounded-xl bg-soft" role="radiogroup">
            {(['sistema', 'claro', 'oscuro'] as Tema[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tema === t} onClick={() => setTema(t)} className={`min-h-[36px] px-3 rounded-lg text-[13px] font-semibold capitalize ${tema === t ? 'bg-card text-ink shadow-card' : 'text-ink2'}`}>{t}</button>
            ))}
          </div>
        </Fila>
      </div>
    </div>
  )
}

function Trabajadores() {
  const lista = useTrabajadores(false)
  const toast = useToast()
  const [nuevo, setNuevo] = useState('')
  const [borrar, setBorrar] = useState<{ id: string; nombre: string } | null>(null)
  const run = (fn: () => Promise<void>, ok: string) => fn().then(() => toast.ok(ok)).catch((e) => toast.error(mensajeDeError(e)))
  if (lista.isPending) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted px-1">Quiénes atienden el local. No son cuentas: se eligen al cerrar el turno.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nuevo.trim()) void run(() => crearTrabajador(nuevo).then(() => setNuevo('')), 'Agregado') }}>
        <input className="input flex-1" placeholder="Nombre" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="Nombre del trabajador" />
        <button type="submit" className="btn-primary px-4" disabled={!nuevo.trim()}>Agregar</button>
      </form>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((t) => (
          <Fila key={t.id} label={t.nombre} hint={t.activo ? undefined : 'Inactivo'}>
            <div className="flex gap-1">
              <button type="button" className="btn-ghost text-[13px] min-h-[38px] px-3" onClick={() => void run(() => actualizarTrabajador(t.id, { activo: !t.activo }), t.activo ? 'Desactivado' : 'Activado')}>{t.activo ? 'Desactivar' : 'Activar'}</button>
              <button type="button" className="btn-ghost text-[13px] min-h-[38px] px-3 text-neg" onClick={() => setBorrar(t)} aria-label={`Eliminar ${t.nombre}`}><Icon name="trash" className="w-4 h-4" /></button>
            </div>
          </Fila>
        ))}
        {(lista.data ?? []).length === 0 && <p className="text-center text-muted py-6 text-sm">Aún no hay trabajadores.</p>}
      </div>
      {borrar && <ConfirmDialog title={`¿Eliminar a ${borrar.nombre}?`} message="Los turnos que atendió quedan sin nombre asociado. Si solo dejó de trabajar, mejor desactívalo." danger confirmLabel="Eliminar" onCancel={() => setBorrar(null)} onConfirm={() => { void run(() => eliminarTrabajador(borrar.id), 'Eliminado'); setBorrar(null) }} />}
    </div>
  )
}

function Metodos() {
  const lista = useMetodos(false)
  const toast = useToast()
  if (lista.isPending) return <Spinner />
  const run = (fn: () => Promise<void>) => fn().catch((e) => toast.error(mensajeDeError(e)))
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted px-1">Los métodos inactivos no aparecen al cerrar el turno. Agregar uno nuevo requiere una migración.</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((m, i, arr) => (
          <Fila key={m.key} label={m.label} hint={m.sub ?? undefined}>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost min-h-[38px] px-2" disabled={i === 0} aria-label="Subir" onClick={() => { const prev = arr[i - 1]; if (prev) void run(async () => { await actualizarMetodo(m.key, { orden: prev.orden }); await actualizarMetodo(prev.key, { orden: m.orden }) }) }}><Icon name="caretUp" className="w-4 h-4" /></button>
              <button type="button" className="btn-ghost min-h-[38px] px-2" disabled={i === arr.length - 1} aria-label="Bajar" onClick={() => { const next = arr[i + 1]; if (next) void run(async () => { await actualizarMetodo(m.key, { orden: next.orden }); await actualizarMetodo(next.key, { orden: m.orden }) }) }}><Icon name="caretDown" className="w-4 h-4" /></button>
              <button type="button" className={`btn-ghost text-[13px] min-h-[38px] px-3 ${m.activo ? '' : 'text-neg'}`} onClick={() => void run(() => actualizarMetodo(m.key, { activo: !m.activo }))}>{m.activo ? 'Activo' : 'Inactivo'}</button>
            </div>
          </Fila>
        ))}
      </div>
    </div>
  )
}

function Papelera() {
  const lista = usePapelera()
  const toast = useToast()
  const [purgar, setPurgar] = useState<string | null>(null)
  if (lista.isPending) return <Spinner />
  const run = (fn: () => Promise<void>, ok: string) => fn().then(() => toast.ok(ok)).catch((e) => toast.error(mensajeDeError(e)))
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted px-1">Turnos eliminados. Se pueden restaurar o borrar definitivamente.</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((t) => (
          <Fila key={t.id} label={`${fechaDiaMes(t.jornada?.fecha)} · ${etiquetaModo(t.jornada?.es_turno_unico && t.tipo === 'mañana' ? 'completo' : t.tipo)}`} hint={`ventas ${clp(totalVentas(t.ventas))} · eliminado ${fechaHora(t.deleted_at)}`}>
            <div className="flex gap-1">
              <button type="button" className="btn-ghost text-[13px] min-h-[38px] px-3" onClick={() => void run(() => restaurarTurno(t.id, t.jornada?.fecha ?? ''), 'Turno restaurado')}><Icon name="undo" className="w-4 h-4" />Restaurar</button>
              <button type="button" className="btn-ghost text-[13px] min-h-[38px] px-3 text-neg" onClick={() => setPurgar(t.id)} aria-label="Borrar definitivamente"><Icon name="trash" className="w-4 h-4" /></button>
            </div>
          </Fila>
        ))}
        {(lista.data ?? []).length === 0 && <p className="text-center text-muted py-6 text-sm">La papelera está vacía.</p>}
      </div>
      {purgar && <ConfirmDialog title="¿Borrar definitivamente?" message="No se puede deshacer." danger confirmLabel="Borrar" onCancel={() => setPurgar(null)} onConfirm={() => { void run(() => purgarTurno(purgar), 'Borrado'); setPurgar(null) }} />}
    </div>
  )
}

function Usuarios() {
  const { usuario: yo } = useUsuario()
  const toast = useToast()
  const [form, setForm] = useState<{ nombre: string; email: string; password: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const lista = useQuery({
    queryKey: qk.usuarios,
    queryFn: async () => { const { data, error } = await supabase.from('usuarios').select('*').order('creado_en'); if (error) throw error; return data },
  })
  async function crear() {
    if (!form) return
    setOcupado(true)
    try {
      const { data, error } = await supabase.functions.invoke('crear-usuario', { body: form })
      if (error) throw error
      if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) throw new Error((data as { error: string }).error)
      toast.ok('Cuenta creada')
      setForm(null)
      await queryClient.invalidateQueries({ queryKey: qk.usuarios })
    } catch (e) { toast.error(mensajeDeError(e)) } finally { setOcupado(false) }
  }
  if (lista.isPending) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted px-1">Cuentas con acceso a la app. Las nuevas se crean como trabajador (ven Hoy y Cerrar turno).</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((u) => (
          <Fila key={u.id} label={u.nombre + (u.id === yo?.id ? ' (tú)' : '')} hint={`${u.email} · ${u.rol}${u.activo ? '' : ' · inactivo'}`}>
            {u.id !== yo?.id && <button type="button" className="btn-ghost text-[13px] min-h-[38px] px-3" onClick={() => void supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id).then(({ error }) => { if (error) toast.error(error.message); else void queryClient.invalidateQueries({ queryKey: qk.usuarios }) })}>{u.activo ? 'Desactivar' : 'Activar'}</button>}
          </Fila>
        ))}
      </div>
      {form ? (
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); void crear() }}>
          <input className="input" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required aria-label="Nombre" />
          <input className="input" placeholder="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required aria-label="Correo" />
          <input className="input" placeholder="Contraseña (mínimo 8)" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required aria-label="Contraseña" />
          <div className="flex gap-2"><button type="button" className="btn-secondary flex-1" onClick={() => setForm(null)}>Cancelar</button><button type="submit" className="btn-primary flex-1" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear cuenta'}</button></div>
        </form>
      ) : <button type="button" className="btn-secondary w-full" onClick={() => setForm({ nombre: '', email: '', password: '' })}><Icon name="plus" className="w-4 h-4" />Nueva cuenta</button>}
    </div>
  )
}

function Errores() {
  const lista = useQuery({
    queryKey: qk.errores,
    queryFn: async () => { const { data, error } = await supabase.from('logs_error').select('id, created_at, mensaje, contexto, ruta').order('created_at', { ascending: false }).limit(50); if (error) throw error; return data },
  })
  if (lista.isPending) return <Spinner />
  return (
    <div className="card p-0 divide-y divide-hairline overflow-hidden">
      {(lista.data ?? []).map((e) => (
        <div key={e.id} className="px-4 py-3">
          <p className="text-[13.5px] text-ink break-words">{e.mensaje}</p>
          <p className="text-[11.5px] text-muted mt-0.5">{fechaHora(e.created_at)}{e.contexto ? ` · ${e.contexto}` : ''}{e.ruta ? ` · ${e.ruta}` : ''}</p>
        </div>
      ))}
      {(lista.data ?? []).length === 0 && <p className="text-center text-muted py-6 text-sm">Sin errores registrados.</p>}
    </div>
  )
}
