import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'

export default function Usuarios() {
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
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 dark:text-zinc-100">Gestión de usuarios</h1>
          <button
            onClick={() => { setMostrarForm(!mostrarForm); setError(''); setExito('') }}
            className="btn-primary"
          >
            {mostrarForm ? 'Cancelar' : (
              <>
                <Icon name="plus" className="w-4 h-4 mr-1.5" stroke={2} />
                Nuevo trabajador
              </>
            )}
          </button>
        </div>

        {exito && (
          <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700 rounded-lg px-4 py-3">
            {exito}
          </p>
        )}

        {mostrarForm && (
          <form onSubmit={crearTrabajador} className="card space-y-4 max-w-lg">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Nuevo trabajador</h2>
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
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button type="submit" disabled={guardando} className="btn-primary w-full">
              {guardando ? 'Creando…' : 'Crear trabajador'}
            </button>
          </form>
        )}

        {/* Lista de usuarios */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-3">Usuarios registrados</h2>
          <div className="grid sm:grid-cols-2 gap-x-6">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-zinc-700">
                <div>
                  <p className="font-medium text-gray-800 dark:text-zinc-200">{u.nombre}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{u.email}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.rol === 'dueño'
                        ? 'bg-[#F5EAD4] dark:bg-[#3d2817] text-[#5C3317] dark:text-[#E8C9A8]'
                        : 'bg-[#E8EDF6] dark:bg-blue-950/40 text-[#33518C] dark:text-blue-300'
                    }`}>
                      {u.rol}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.activo
                        ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-zinc-500'
                    }`}>
                      {u.activo ? 'activo' : 'desactivado'}
                    </span>
                  </div>
                </div>
                {u.rol !== 'dueño' && (
                  <button
                    onClick={() => toggleActivo(u)}
                    className={`text-sm px-3 py-1 rounded-lg border transition-colors ${
                      u.activo
                        ? 'border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                        : 'border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30'
                    }`}
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
