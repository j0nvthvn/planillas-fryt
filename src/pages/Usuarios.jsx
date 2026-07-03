import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'

const AVATAR_COLORS = ['#8B5D39', '#1E7A4F', '#33518C', '#B45309', '#0F766E', '#BE185D']
function avatarColor(nombre) {
  let h = 0
  for (const c of String(nombre)) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function UsuarioAvatar({ nombre }) {
  const inicial = (nombre?.[0] || '?').toUpperCase()
  return (
    <div
      className="w-10 h-10 rounded-full grid place-items-center text-white font-bold text-[15px] shrink-0"
      style={{ background: avatarColor(nombre) }}
    >
      {inicial}
    </div>
  )
}

function RolBadge({ rol }) {
  if (rol === 'dueño') {
    return (
      <span className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-0.5 bg-brand-tint text-brand border border-brand/30">
        Dueño
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-0.5 bg-hairline text-ink2">
      Trabajador
    </span>
  )
}

export default function Usuarios() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('nombre')
    setUsuarios(data || [])
    setCargando(false)
  }

  async function crearTrabajador(e) {
    e.preventDefault()
    setError('')
    setGuardando(true)

    try {
      const { data, error } = await supabase.functions.invoke('crear-usuario', {
        body: { nombre: form.nombre, email: form.email, password: form.password },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setExito(`Trabajador ${form.nombre} creado exitosamente.`)
      setForm({ nombre: '', email: '', password: '' })
      setMostrarForm(false)
      cargarUsuarios()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al crear el trabajador.')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(usuario) {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !usuario.activo })
      .eq('id', usuario.id)

    if (!error) {
      setUsuarios((prev) =>
        prev.map((u) => u.id === usuario.id ? { ...u, activo: !u.activo } : u)
      )
    }
  }

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"
        >
          <Icon name="arrowLeft" className="w-4 h-4" stroke={2} />
          Volver
        </button>

        <div className="flex items-center justify-between gap-3">
          <PageHeader title="Usuarios" />
          <button
            onClick={() => { setMostrarForm(!mostrarForm); setError(''); setExito('') }}
            aria-label="Nuevo trabajador"
            className="w-10 h-10 rounded-[13px] bg-brand text-white grid place-items-center shrink-0 hover:bg-brand-hover transition-colors"
          >
            <Icon name="plus" className="w-5 h-5" stroke={2.2} />
          </button>
        </div>

        {exito && (
          <p className="text-sm text-pos bg-pos-tint border border-pos/30 rounded-lg px-4 py-3">
            {exito}
          </p>
        )}

        {mostrarForm && (
          <form onSubmit={crearTrabajador} className="card space-y-4">
            <h2 className="font-semibold text-ink text-[15px]">Nuevo trabajador</h2>
            <div>
              <label className="label">Nombre completo</label>
              <input
                type="text"
                className="input"
                required
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del trabajador"
              />
            </div>
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="label">Contraseña temporal</label>
              <input
                type="text"
                className="input"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            {error && (
              <p className="text-sm text-neg bg-neg-tint border border-neg/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button type="submit" disabled={guardando} className="btn-primary w-full py-3">
              {guardando ? 'Creando…' : 'Crear trabajador'}
            </button>
          </form>
        )}

        <div className="space-y-2.5">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl bg-card border border-hairline p-3.5 flex items-center gap-3"
            >
              <UsuarioAvatar nombre={u.nombre} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink truncate">{u.nombre}</p>
                <p className="text-[12px] text-muted truncate">{u.email}</p>
                <div className="flex gap-1.5 mt-1.5">
                  <RolBadge rol={u.rol} />
                  {u.activo === false && (
                    <span className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-0.5 bg-hairline text-muted">
                      Desactivado
                    </span>
                  )}
                </div>
              </div>
              {u.rol !== 'dueño' && (
                <button
                  onClick={() => toggleActivo(u)}
                  className={`shrink-0 text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                    u.activo
                      ? 'border-neg/30 text-neg hover:bg-neg-tint'
                      : 'border-pos/30 text-pos hover:bg-pos-tint'
                  }`}
                >
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
