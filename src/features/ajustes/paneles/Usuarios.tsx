import { useState } from 'react'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { useAccion } from '@/hooks/useAccion'
import { useUsuario } from '@/hooks/useUsuario'
import { useUsuarios, actualizarUsuario, crearUsuario, type NuevaCuenta } from '../api'
import { ACCION, Fila } from '../Fila'

export function Usuarios() {
  const { usuario: yo } = useUsuario()
  const run = useAccion()
  const [form, setForm] = useState<NuevaCuenta | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const lista = useUsuarios()
  async function crear() {
    if (!form) return
    setOcupado(true)
    try {
      await run(() => crearUsuario(form).then(() => setForm(null)), 'Cuenta creada')
    } finally { setOcupado(false) }
  }
  if (lista.isPending) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">Cuentas con acceso a la app. Las nuevas se crean como trabajador (ven Hoy y Cerrar turno).</p>
      <div className="card p-0 divide-y divide-hairline overflow-hidden">
        {(lista.data ?? []).map((u) => (
          <Fila key={u.id} label={u.nombre + (u.id === yo?.id ? ' (tú)' : '')} hint={`${u.email} · ${u.rol}${u.activo ? '' : ' · inactivo'}`}>
            {u.id !== yo?.id && (
              <button type="button" className={`${ACCION} font-semibold border border-hairline-strong text-ink2 hover:bg-soft`} aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
                onClick={() => void run(() => actualizarUsuario(u.id, { activo: !u.activo }))}>{u.activo ? 'Desactivar' : 'Activar'}</button>
            )}
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
