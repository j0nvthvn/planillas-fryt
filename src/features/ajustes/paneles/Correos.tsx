import { useId, useState } from 'react'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { PILDORA, PILDORA_ON, PILDORA_OFF } from '@/components/pildora'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { mensajeDeError } from '@/lib/errorLog'
import { useAccion } from '@/hooks/useAccion'
import { useUsuario } from '@/hooks/useUsuario'
import {
  useDestinatarios, crearDestinatario, actualizarDestinatario, eliminarDestinatario,
  useAjustesCorreo, guardarAjusteCorreo, enviarPrueba, correoValido, TIPOS_CORREO, HORAS_RESUMEN,
  type Destinatario, type TipoCorreo,
} from '@/features/correos/api'
import { ACCION, CAMPO, Fila } from '../Fila'

export function Correos() {
  const ajustes = useAjustesCorreo()
  const lista = useDestinatarios()
  const { usuario: yo } = useUsuario()
  const toast = useToast()
  const run = useAccion()
  const [nuevo, setNuevo] = useState({ nombre: '', email: '' })
  const [borrar, setBorrar] = useState<Destinatario | null>(null)
  const [probando, setProbando] = useState<TipoCorreo | null>(null)
  const horaId = useId()
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
