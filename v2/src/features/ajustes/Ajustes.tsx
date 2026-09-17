import { useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { MetodoLogo } from '@/components/MetodoLogo'
import { PILDORA, PILDORA_ON, PILDORA_OFF } from '@/components/pildora'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MontoInput, HoraInput } from '@/components/MontoInput'
import { useToast } from '@/components/Toast'
import { useTema, type Tema } from '@/lib/theme'
import { cerrarSesion } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { qk, queryClient } from '@/lib/query'
import { mensajeDeError } from '@/lib/errorLog'
import { clp, fechaHora, fechaDiaMes } from '@/lib/format'
import { totalVentas } from '@/lib/totales'
import { useUsuario } from '@/hooks/useUsuario'
import { useRovingRadio } from '@/hooks/useRovingRadio'
import {
  useConfig, useGuardarConfig, useTrabajadores, crearTrabajador, actualizarTrabajador, eliminarTrabajador,
  useMetodos, actualizarMetodo, type Config,
} from '@/features/catalogo/api'
import {
  useDestinatarios, crearDestinatario, actualizarDestinatario, eliminarDestinatario,
  useAjustesCorreo, guardarAjusteCorreo, enviarPrueba, correoValido, TIPOS_CORREO, HORAS_RESUMEN,
  type Destinatario, type TipoCorreo,
} from '@/features/correos/api'
import { usePapelera, restaurarTurno, purgarTurno, etiquetaModo } from '@/features/turno/api'
import { leerMetricas } from '@/features/turno/metricas'

type Seccion = 'general' | 'correos' | 'trabajadores' | 'metodos' | 'papelera' | 'usuarios' | 'errores'
const SECCIONES: { v: Seccion; label: string }[] = [
  { v: 'general', label: 'General' },
  { v: 'correos', label: 'Correos' },
  { v: 'trabajadores', label: 'Trabajadores' },
  { v: 'metodos', label: 'Métodos de pago' },
  { v: 'papelera', label: 'Papelera' },
  { v: 'usuarios', label: 'Cuentas' },
  { v: 'errores', label: 'Errores' },
]
/** Campo dentro de una fila: más bajo y chico que el `input` suelto. */
const CAMPO = 'min-h-[38px]! py-1.5! rounded-[10px]!'
/** Acción chica de una fila (badge-botón de 34 px). */
const ACCION = 'hit inline-flex items-center justify-center gap-[5px] min-h-[34px] px-2.5 rounded-[9px] text-xs transition-colors disabled:opacity-40'

export default function Ajustes() {
  const { seccion = 'general' } = useSearch({ from: '/app/ajustes' })
  const { config } = useConfig()
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow={config.nombreLocal || 'FrytControl'} title="Ajustes" action={<button type="button" className="btn-secondary btn-bar" onClick={() => void cerrarSesion()}><Icon name="logout" className="w-4 h-4" />Salir</button>} />
      {/* Cada sección tiene su URL: es navegación, no pestañas. */}
      <nav className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-3 md:flex-wrap md:mx-0 md:px-0" aria-label="Secciones de Ajustes">
        {SECCIONES.map((s) => (
          <Link key={s.v} to="/ajustes" search={{ seccion: s.v }} aria-current={seccion === s.v ? 'page' : undefined}
            className={`${PILDORA} ${seccion === s.v ? PILDORA_ON : PILDORA_OFF}`}>
            {s.label}
          </Link>
        ))}
      </nav>
      {seccion === 'general' && (
        <Link to="/proveedores" className="card rounded-[14px] py-3.5 mb-5 flex items-center gap-3 hover:border-hairline-strong">
          <span className="w-10 h-10 rounded-[11px] bg-brand-tint text-brand grid place-items-center shrink-0" aria-hidden="true"><Icon name="suppliers" className="w-5 h-5" /></span>
          <span className="flex-1 min-w-0"><span className="block text-base font-semibold text-ink">Proveedores</span><span className="block text-xs text-muted mt-0.5">Catálogo: renombrar, fusionar duplicados, logos</span></span>
          <Icon name="chevR" className="w-[15px] h-[15px] text-muted2 shrink-0" />
        </Link>
      )}
      {seccion === 'general' && <General />}
      {seccion === 'correos' && <Correos />}
      {seccion === 'trabajadores' && <Trabajadores />}
      {seccion === 'metodos' && <Metodos />}
      {seccion === 'papelera' && <Papelera />}
      {seccion === 'usuarios' && <Usuarios />}
      {seccion === 'errores' && <Errores />}
    </div>
  )
}

/** `apilar`: en el celular la etiqueta va arriba y el campo abajo a todo lo ancho. */
function Fila({ label, hint, apilar, alta, children }: { label: string; hint?: string; apilar?: boolean; alta?: boolean; children: ReactNode }) {
  return (
    <div className={`flex justify-between gap-3 px-4 py-2.5 ${alta ? 'min-h-[68px]' : 'min-h-[60px]'} ${apilar ? 'flex-col items-stretch gap-2 sm:flex-row sm:items-center' : 'items-center'}`}>
      <div className="min-w-0"><p className="text-base font-medium text-ink">{label}</p>{hint && <p className="text-xs text-muted tabular-nums mt-0.5">{hint}</p>}</div>
      {children}
    </div>
  )
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function General() {
  const { config, cargando } = useConfig()
  const guardar = useGuardarConfig()
  const toast = useToast()
  const { tema, setTema } = useTema()
  const [form, setForm] = useState<Config | null>(null)
  const temas: Tema[] = ['sistema', 'claro', 'oscuro']
  const temaRadio = useRovingRadio(temas, tema, setTema)
  const diasId = useId()
  const f = form ?? config
  if (cargando) return <Spinner />
  const set = (c: Partial<Config>) => setForm({ ...f, ...c })
  return (
    <div>
      <h2 className="eyebrow mb-[9px]">Operación</h2>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        <Fila apilar label="Nombre del local"><input className={`input ${CAMPO} w-full sm:w-40 sm:text-right`} value={f.nombreLocal} onChange={(e) => set({ nombreLocal: e.target.value })} aria-label="Nombre del local" /></Fila>
        <Fila apilar label="Fondo de caja por defecto" hint="Con lo que parte cada turno"><MontoInput className={`${CAMPO} font-display font-semibold w-full sm:w-40 sm:text-right`} value={f.fondoCajaInicial} onChange={(n) => set({ fondoCajaInicial: n })} ariaLabel="Fondo de caja por defecto" /></Fila>
        <Fila apilar label="Corte de la mañana" hint="Hora en que termina el turno mañana"><HoraInput className={`${CAMPO} font-display font-semibold w-full sm:w-32 sm:text-right`} value={f.horaCorteManana} onChange={(h) => set({ horaCorteManana: h })} ariaLabel="Corte de la mañana" /></Fila>
        <div className="px-4 py-3.5">
          <p id={diasId} className="text-base font-medium text-ink">Días de un solo turno</p>
          <p id={`${diasId}-ayuda`} className="text-xs text-muted mt-0.5 mb-2.5">Esos días se registran siempre como día completo</p>
          <div className="grid grid-cols-7 gap-1" role="group" aria-labelledby={diasId} aria-describedby={`${diasId}-ayuda`}>
            {DIAS.map((d, i) => {
              const on = f.diasTurnoUnico.includes(i)
              return <button key={d} type="button" aria-pressed={on} aria-label={DIAS_LARGOS[i]} onClick={() => set({ diasTurnoUnico: on ? f.diasTurnoUnico.filter((x) => x !== i) : [...f.diasTurnoUnico, i].sort() })}
                className={`hit min-h-[38px] px-0 rounded-[9px] text-sm border transition-colors ${on ? 'bg-ink text-card border-ink font-semibold' : 'bg-card text-ink2 border-hairline-strong font-medium hover:bg-soft'}`}>{d}</button>
            })}
          </div>
        </div>
      </div>
      {form && <button type="button" className="btn-primary btn-lg w-full mt-3" disabled={guardar.isPending} onClick={() => guardar.mutate(form, { onSuccess: () => { setForm(null); toast.ok('Ajustes guardados') }, onError: (e) => toast.error(mensajeDeError(e)) })}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</button>}
      <h2 className="eyebrow mt-5 mb-[9px]">Aplicación</h2>
      <div className="space-y-3">
        <TiempoDeCierre />
        <div className="card p-0 overflow-hidden">
          <Fila label="Apariencia">
            <div className="segmented" role="radiogroup" aria-label="Apariencia">
              {temas.map((t, i) => (
                <button key={t} type="button" {...temaRadio(t, i)} onClick={() => setTema(t)} className={`hit ${tema === t ? 'segmented-item-on' : 'segmented-item'} min-h-[36px] px-[11px] capitalize`}>{t}</button>
              ))}
            </div>
          </Fila>
        </div>
      </div>
    </div>
  )
}

/** Criterio del piloto: el cierre en la v2 debe tomar menos que en la app actual. */
function TiempoDeCierre() {
  const q = useQuery({ queryKey: ['metricas-cierre'], queryFn: leerMetricas, staleTime: 0, gcTime: 0 })
  const lista = q.data ?? []
  if (lista.length === 0) return null
  const prom = Math.round(lista.reduce((s, m) => s + m.segundos, 0) / lista.length)
  return (
    <div className="card p-0 overflow-hidden">
      <Fila label="Tiempo de cierre en este dispositivo" hint={`${lista.length} cierre${lista.length === 1 ? '' : 's'} medidos · promedio ${Math.floor(prom / 60)} min ${prom % 60} s`}>
        <span className="text-xs text-muted tabular-nums text-right">{lista.slice(0, 3).map((m) => `${fechaDiaMes(m.fecha)} ${Math.floor(m.segundos / 60)}:${String(m.segundos % 60).padStart(2, '0')}`).join(' · ')}</span>
      </Fila>
    </div>
  )
}

function Correos() {
  const ajustes = useAjustesCorreo()
  const lista = useDestinatarios()
  const { usuario: yo } = useUsuario()
  const toast = useToast()
  const [nuevo, setNuevo] = useState({ nombre: '', email: '' })
  const [borrar, setBorrar] = useState<Destinatario | null>(null)
  const [probando, setProbando] = useState<TipoCorreo | null>(null)
  const horaId = useId()
  const run = (fn: () => Promise<void>, ok?: string) => fn().then(() => { if (ok) toast.ok(ok) }).catch((e) => toast.error(mensajeDeError(e)))
  if (ajustes.isPending || lista.isPending) return <Spinner />
  const a = ajustes.data ?? { activos: true, hora: 8 }
  const emailValido = correoValido(nuevo.email)
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`
  async function probar(tipo: TipoCorreo) {
    setProbando(tipo)
    try {
      await enviarPrueba(tipo)
      toast.ok(`Prueba enviada a ${yo?.email ?? 'tu correo'}`)
    } catch (e) { toast.error(mensajeDeError(e)) } finally { setProbando(null) }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">El aviso de cierre llega al cerrar cada turno. Los resúmenes llegan a la hora elegida: el diario cada día, el semanal los lunes y el mensual el día 1.</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        <Fila label="Enviar correos" hint={a.activos ? 'Según lo que marque cada persona' : 'No sale ningún correo'}>
          <button type="button" role="switch" aria-checked={a.activos} aria-label="Enviar correos" onClick={() => void run(() => guardarAjusteCorreo({ activos: !a.activos }), a.activos ? 'Correos apagados' : 'Correos activados')}
            className={`${ACCION} font-semibold ${a.activos ? 'bg-pos-tint text-pos' : 'bg-neg-tint text-neg'}`}>{a.activos ? 'Activos' : 'Apagados'}</button>
        </Fila>
        <Fila label="Hora de los resúmenes" hint="Hora de Chile">
          <select id={horaId} className={`input ${CAMPO} w-28 text-right`} value={a.hora} aria-label="Hora de los resúmenes" disabled={!a.activos}
            onChange={(e) => void run(() => guardarAjusteCorreo({ hora: Number(e.target.value) }), 'Hora guardada')}>
            {(HORAS_RESUMEN.includes(a.hora) ? HORAS_RESUMEN : [...HORAS_RESUMEN, a.hora].sort((x, y) => x - y)).map((h) => <option key={h} value={h}>{hh(h)}</option>)}
          </select>
        </Fila>
      </div>

      <h2 className="eyebrow pt-2">Quién recibe qué</h2>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((d) => {
          const esCuenta = d.usuario_id !== null
          const titulo = d.nombre || d.email
          return (
            <div key={d.id} className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-base font-medium truncate ${d.activo ? 'text-ink' : 'text-muted'}`}>{titulo}{esCuenta && d.usuario_id === yo?.id ? ' (tú)' : ''}</p>
                  <p className="text-xs text-muted truncate">{[d.nombre ? d.email : null, esCuenta ? 'cuenta' : 'correo agregado', d.activo ? null : 'no recibe nada'].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" className={`${ACCION} font-semibold border border-hairline-strong text-ink2 hover:bg-soft`} aria-label={`${d.activo ? 'Pausar' : 'Reanudar'} correos para ${titulo}`}
                    onClick={() => void run(() => actualizarDestinatario(d.id, { activo: !d.activo }))}>{d.activo ? 'Pausar' : 'Reanudar'}</button>
                  {!esCuenta && <button type="button" className={`${ACCION} w-[34px] px-0 text-neg hover:bg-neg-tint`} onClick={() => setBorrar(d)} aria-label={`Quitar ${titulo}`}><Icon name="trash" className="w-4 h-4" /></button>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Correos que recibe ${titulo}`}>
                {TIPOS_CORREO.map((t) => {
                  const on = d[t.tipo]
                  return (
                    <button key={t.tipo} type="button" aria-pressed={on} disabled={!d.activo} title={t.cuando}
                      onClick={() => void run(() => actualizarDestinatario(d.id, { [t.tipo]: !on }))}
                      className={`${PILDORA} ${on ? PILDORA_ON : PILDORA_OFF} disabled:opacity-40`}>
                      {on && <Icon name="check" className="w-3.5 h-3.5 mr-1" />}{t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); if (emailValido) void run(() => crearDestinatario(nuevo.email, nuevo.nombre).then(() => setNuevo({ nombre: '', email: '' })), 'Correo agregado') }}>
        <p className="text-base font-semibold text-ink">Agregar otro correo</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <input id="correo-nuevo-nombre" className="input" placeholder="Nombre (opcional)" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} aria-label="Nombre" autoComplete="off" />
          <input id="correo-nuevo-email" className="input" type="email" inputMode="email" placeholder="nombre@correo.cl" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} aria-label="Correo" autoComplete="off"
            aria-invalid={nuevo.email !== '' && !emailValido} aria-describedby="correo-nuevo-ayuda" />
          <button type="submit" className="btn-primary px-4" disabled={!emailValido}>Agregar</button>
        </div>
        <p id="correo-nuevo-ayuda" className="text-xs text-muted">{nuevo.email !== '' && !emailValido ? 'Revisa el correo: no parece válido.' : 'Recibe el cierre, el semanal y el mensual; después puedes cambiarlo.'}</p>
      </form>

      <h2 className="eyebrow pt-2">Probar</h2>
      <div className="card space-y-3">
        <p className="text-sm text-muted">Te manda el último de cada uno solo a {yo?.email ?? 'tu correo'}, aunque no lo tengas marcado.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIPOS_CORREO.map((t) => (
            <button key={t.tipo} type="button" className="btn-secondary" disabled={probando !== null} onClick={() => void probar(t.tipo)}>
              {probando === t.tipo ? 'Enviando…' : t.label}
            </button>
          ))}
        </div>
      </div>
      {borrar && <ConfirmDialog title={`¿Quitar a ${borrar.nombre || borrar.email}?`} message="Deja de recibir todos los correos. Puedes agregarlo de nuevo cuando quieras." danger confirmLabel="Quitar" onCancel={() => setBorrar(null)} onConfirm={() => { void run(() => eliminarDestinatario(borrar.id), 'Correo quitado'); setBorrar(null) }} />}
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
      <p className="text-sm leading-relaxed text-muted">Quiénes atienden el local. No son cuentas: se eligen al cerrar el turno.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nuevo.trim()) void run(() => crearTrabajador(nuevo).then(() => setNuevo('')), 'Agregado') }}>
        <input className="input flex-1" placeholder="Nombre" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="Nombre del trabajador" />
        <button type="submit" className="btn-primary px-4" disabled={!nuevo.trim()}>Agregar</button>
      </form>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((t) => (
          <Fila key={t.id} label={t.nombre} hint={t.activo ? undefined : 'Inactivo'}>
            <div className="flex items-center gap-1.5">
              <button type="button" className={`${ACCION} font-semibold border border-hairline-strong text-ink2 hover:bg-soft`} aria-label={`${t.activo ? 'Desactivar' : 'Activar'} a ${t.nombre}`} onClick={() => void run(() => actualizarTrabajador(t.id, { activo: !t.activo }), t.activo ? 'Desactivado' : 'Activado')}>{t.activo ? 'Desactivar' : 'Activar'}</button>
              <button type="button" className={`${ACCION} w-[34px] px-0 text-neg hover:bg-neg-tint`} onClick={() => setBorrar(t)} aria-label={`Eliminar ${t.nombre}`}><Icon name="trash" className="w-4 h-4" /></button>
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
      <p className="text-sm leading-relaxed text-muted">Los métodos inactivos no aparecen al cerrar el turno. "Total del día" es para máquinas que no cierran por turno: al cerrar la tarde se escribe el total y la app resta la mañana.</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((m, i, arr) => (
          <div key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 min-h-[68px]">
            <span className={m.activo ? '' : 'opacity-50'}><MetodoLogo metodo={m} /></span>
            <div className="flex-1 min-w-0">
              <p className={`text-base font-medium truncate ${m.activo ? 'text-ink' : 'text-muted'}`}>{m.label}</p>
              {(m.sub || m.acumulado_diario) && <p className="text-xs text-muted mt-0.5">{[m.sub, m.acumulado_diario ? 'la máquina muestra el total del día' : null].filter(Boolean).join(' · ')}</p>}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button type="button" className={`${ACCION} w-[38px] min-h-[38px] px-0 text-ink2 hover:bg-soft`} disabled={i === 0} aria-label={`Subir ${m.label}`} onClick={() => { const prev = arr[i - 1]; if (prev) void run(async () => { await actualizarMetodo(m.key, { orden: prev.orden }); await actualizarMetodo(prev.key, { orden: m.orden }) }) }}><Icon name="caretUp" className="w-4 h-4" /></button>
              <button type="button" className={`${ACCION} w-[38px] min-h-[38px] px-0 text-ink2 hover:bg-soft`} disabled={i === arr.length - 1} aria-label={`Bajar ${m.label}`} onClick={() => { const next = arr[i + 1]; if (next) void run(async () => { await actualizarMetodo(m.key, { orden: next.orden }); await actualizarMetodo(next.key, { orden: m.orden }) }) }}><Icon name="caretDown" className="w-4 h-4" /></button>
            </div>
            {/* En el celular las acciones van en una segunda línea: al lado del nombre lo cortaban. */}
            <div className="flex items-center gap-1.5 basis-full pl-[52px] sm:basis-auto sm:pl-0">
              <button type="button" className={`${ACCION} ${m.acumulado_diario ? 'bg-brand-tint text-brand font-semibold' : 'border border-hairline-strong text-muted font-medium hover:bg-soft'}`} aria-pressed={m.acumulado_diario} aria-label={`Total del día en ${m.label}`} title="La máquina muestra el total del día" onClick={() => void run(() => actualizarMetodo(m.key, { acumulado_diario: !m.acumulado_diario }))}>Total del día</button>
              <button type="button" className={`${ACCION} font-semibold ${m.activo ? 'bg-pos-tint text-pos' : 'bg-neg-tint text-neg'}`} aria-pressed={m.activo} aria-label={`${m.label} activo`} onClick={() => void run(() => actualizarMetodo(m.key, { activo: !m.activo }))}>{m.activo ? 'Activo' : 'Inactivo'}</button>
            </div>
          </div>
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
      <p className="text-sm leading-relaxed text-muted">Turnos eliminados. Se pueden restaurar o borrar definitivamente.</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((t) => (
          <Fila key={t.id} alta label={`${fechaDiaMes(t.jornada?.fecha)} · ${etiquetaModo(t.jornada?.es_turno_unico && t.tipo === 'mañana' ? 'completo' : t.tipo)}`} hint={`ventas ${clp(totalVentas(t.ventas))} · eliminado ${fechaHora(t.deleted_at)}`}>
            <div className="flex items-center gap-1.5">
              <button type="button" className={`${ACCION} font-semibold border border-hairline-strong text-ink2 hover:bg-soft`} aria-label={`Restaurar ${fechaDiaMes(t.jornada?.fecha)}`} onClick={() => void run(() => restaurarTurno(t.id, t.jornada?.fecha ?? ''), 'Turno restaurado')}><Icon name="undo" className="w-3.5 h-3.5" />Restaurar</button>
              <button type="button" className={`${ACCION} w-[34px] px-0 text-neg hover:bg-neg-tint`} onClick={() => setPurgar(t.id)} aria-label={`Borrar definitivamente ${fechaDiaMes(t.jornada?.fecha)}`}><Icon name="trash" className="w-4 h-4" /></button>
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
      // `invoke` devuelve el error sin tipo: se normaliza a Error.
      const r = await supabase.functions.invoke<{ error?: string }>('crear-usuario', { body: form })
      if (r.error) throw r.error instanceof Error ? r.error : new Error(mensajeDeError(r.error))
      if (r.data?.error) throw new Error(r.data.error)
      toast.ok('Cuenta creada')
      setForm(null)
      await queryClient.invalidateQueries({ queryKey: qk.usuarios })
    } catch (e) { toast.error(mensajeDeError(e)) } finally { setOcupado(false) }
  }
  if (lista.isPending) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">Cuentas con acceso a la app. Las nuevas se crean como trabajador (ven Hoy y Cerrar turno).</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((u) => (
          <Fila key={u.id} label={u.nombre + (u.id === yo?.id ? ' (tú)' : '')} hint={`${u.email} · ${u.rol}${u.activo ? '' : ' · inactivo'}`}>
            {u.id !== yo?.id && <button type="button" className={`${ACCION} font-semibold border border-hairline-strong text-ink2 hover:bg-soft`} aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`} onClick={() => void supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id).then(({ error }) => { if (error) toast.error(error.message); else void queryClient.invalidateQueries({ queryKey: qk.usuarios }) })}>{u.activo ? 'Desactivar' : 'Activar'}</button>}
          </Fila>
        ))}
      </div>
      {form ? (
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); void crear() }}>
          <label className="block"><span className="label">Nombre</span>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoComplete="off" /></label>
          <label className="block"><span className="label">Correo</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="off" /></label>
          <label className="block"><span className="label">Contraseña</span>
            <input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" aria-describedby="cuenta-clave-ayuda" /></label>
          <p id="cuenta-clave-ayuda" className="text-xs text-muted -mt-1.5">Mínimo 8 caracteres.</p>
          <div className="flex gap-2"><button type="button" className="btn-secondary btn-lg flex-1" onClick={() => setForm(null)}>Cancelar</button><button type="submit" className="btn-primary btn-lg flex-1" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear cuenta'}</button></div>
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
          <p className="text-sm text-ink break-words">{e.mensaje}</p>
          <p className="text-xs text-muted mt-0.5">{fechaHora(e.created_at)}{e.contexto ? ` · ${e.contexto}` : ''}{e.ruta ? ` · ${e.ruta}` : ''}</p>
        </div>
      ))}
      {(lista.data ?? []).length === 0 && <p className="text-center text-muted py-6 text-sm">Sin errores registrados.</p>}
    </div>
  )
}
