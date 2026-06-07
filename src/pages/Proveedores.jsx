import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'

const AVATAR_COLORS = ['#5C3317', '#1E7A4F', '#33518C', '#B45309', '#0F766E', '#BE185D']
function avatarColor(nombre) {
  let h = 0
  for (const c of String(nombre)) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function ProveedorAvatar({ nombre = '', imagen_url, size = 'md' }) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [imagen_url])
  const inicial = (nombre[0] || '?').toUpperCase()
  const color = avatarColor(nombre || '?')
  const sizes = { sm: 'w-9 h-9 text-sm', md: 'w-12 h-12 text-lg', lg: 'w-20 h-20 text-3xl' }
  const cls = `${sizes[size]} rounded-xl overflow-hidden shrink-0 flex items-center justify-center font-bold text-white`

  if (imagen_url && !imgError) {
    return (
      <div className={cls} style={{ background: '#F3F4F6' }}>
        <img src={imagen_url} alt={nombre} className="w-full h-full object-contain p-0.5"
          onError={() => { console.warn('[Avatar] No se pudo cargar:', imagen_url); setImgError(true) }} />
      </div>
    )
  }
  return <div className={cls} style={{ background: color }}>{inicial}</div>
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)   // { id, nombre, imagen_url, nombreNuevo, imagenFile, preview }
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [showEliminarConfirm, setShowEliminarConfirm] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('proveedores_frecuentes')
      .select('id, nombre, imagen_url')
      .order('nombre')
    setProveedores(data || [])
    setCargando(false)
  }

  function abrirNuevo() {
    setError('')
    setEditando({ id: null, nombre: '', imagen_url: '', nombreNuevo: '', imagenFile: null, preview: '' })
  }

  function abrirEditar(p) {
    setError('')
    setEditando({ id: p.id, nombre: p.nombre, imagen_url: p.imagen_url || '', nombreNuevo: p.nombre, imagenFile: null, preview: p.imagen_url || '' })
  }

  function handlePickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setEditando((s) => ({ ...s, imagenFile: file, preview }))
  }

  async function subirImagen() {
    if (!editando.imagenFile) return editando.imagen_url
    const ext = (editando.imagenFile.name.split('.').pop() || 'jpg').toLowerCase()
    const slug = editando.nombreNuevo.trim()
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)
    const path = `${slug}-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('logos-proveedores')
      .upload(path, editando.imagenFile, { contentType: editando.imagenFile.type })
    if (uploadErr) throw uploadErr
    const { data: { publicUrl } } = supabase.storage.from('logos-proveedores').getPublicUrl(path)
    const check = await fetch(publicUrl, { method: 'HEAD' }).catch(() => null)
    if (!check || !check.ok) {
      throw new Error(
        `La imagen se subió pero no es pública (HTTP ${check?.status ?? 'sin respuesta'}).\n` +
        `En el panel de Supabase → Storage → logos-proveedores → Settings → activa "Public bucket".`
      )
    }
    return publicUrl
  }

  async function guardar() {
    if (!editando.nombreNuevo.trim()) return
    setGuardando(true)
    setError('')
    try {
      const imagen_url = await subirImagen()

      if (editando.id) {
        // Modo editar
        const nombreNuevo = editando.nombreNuevo.trim()
        const nombreCambio = nombreNuevo !== editando.nombre

        // Cascada: actualizar registros históricos si el nombre cambió
        if (nombreCambio) {
          const { error: cascadaErr } = await supabase
            .from('proveedores_turno')
            .update({ nombre: nombreNuevo })
            .eq('nombre', editando.nombre)
          if (cascadaErr) throw cascadaErr
        }

        const { data: filas, error: dbErr } = await supabase
          .from('proveedores_frecuentes')
          .update({ nombre: nombreNuevo, imagen_url })
          .eq('id', editando.id)
          .select()
        if (dbErr) throw dbErr
        if (!filas || filas.length === 0) {
          throw new Error('No se pudo guardar: falta una política UPDATE en la tabla proveedores_frecuentes. Agrégala en Supabase → Authentication → Policies.')
        }
        setProveedores((prev) => prev.map((p) =>
          p.id === editando.id ? { ...p, nombre: nombreNuevo, imagen_url } : p
        ))
      } else {
        // Modo crear
        const { data: nuevo, error: dbErr } = await supabase
          .from('proveedores_frecuentes')
          .insert({ nombre: editando.nombreNuevo.trim(), imagen_url: imagen_url || null })
          .select()
          .single()
        if (dbErr) throw dbErr
        setProveedores((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      }

      setEditando(null)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id) {
    await supabase.from('proveedores_frecuentes').delete().eq('id', id)
    setProveedores((prev) => prev.filter((p) => p.id !== id))
    setEditando(null)
  }

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Proveedores frecuentes</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Logos y nombres para el acceso rápido en Turno.</p>
          </div>
          <button onClick={abrirNuevo} className="btn-primary shrink-0">
            <Icon name="plus" className="w-4 h-4 mr-1.5" stroke={2} />
            Nuevo
          </button>
        </div>

        {proveedores.length === 0 && (
          <div className="card text-center text-gray-400 dark:text-zinc-500 py-12">
            Todavía no hay proveedores frecuentes.<br />
            <span className="text-sm">Agrega uno manualmente o guarda un turno.</span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {proveedores.map((p) => (
            <button key={p.id} onClick={() => abrirEditar(p)}
              className="card !py-3 !px-4 flex items-center gap-3 text-left hover:border-[#5C3317]/30 dark:hover:border-brand/40 hover:shadow-md transition">
              <ProveedorAvatar nombre={p.nombre} imagen_url={p.imagen_url} size="sm" />
              <span className="flex-1 font-medium text-gray-900 dark:text-zinc-100 truncate">{p.nombre}</span>
              <Icon name="edit" className="w-4 h-4 text-gray-300 dark:text-zinc-600 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Overlay */}
      {editando && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setEditando(null)} />}

      {/* Sheet edición */}
      {editando && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-zinc-900 rounded-t-3xl px-5 pt-3 pb-10 shadow-2xl flex flex-col gap-4 md:inset-x-auto md:left-1/2 md:bottom-auto md:top-[8vh] md:w-[440px] md:rounded-3xl md:max-h-[80vh] md:overflow-y-auto"
          style={{ animation: 'sheetUp .26s cubic-bezier(.2,.8,.2,1)', transform: window.matchMedia('(min-width: 768px)').matches ? 'translateX(-50%)' : undefined }}>
          <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
          <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-zinc-600 mx-auto" />

          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-gray-900 dark:text-zinc-100">
              {editando.id ? 'Editar proveedor' : 'Nuevo proveedor'}
            </h3>
            <div className="flex gap-2">
              {editando.id && (
                <button onClick={() => setShowEliminarConfirm(true)}
                  className="w-8 h-8 rounded-full grid place-items-center bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400">
                  <Icon name="trash" className="w-[18px] h-[18px]" />
                </button>
              )}
              <button onClick={() => setEditando(null)}
                className="w-8 h-8 rounded-full grid place-items-center bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300">
                <Icon name="close" className="w-[17px] h-[17px]" />
              </button>
            </div>
          </div>

          {/* Avatar grande con cámara */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <ProveedorAvatar nombre={editando.nombreNuevo || 'P'} imagen_url={editando.preview} size="lg" />
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-gray-200 shadow grid place-items-center cursor-pointer text-gray-500 hover:text-gray-800 transition">
                <input type="file" accept="image/*" className="sr-only" onChange={handlePickImage} />
                <Icon name="camera" className="w-4 h-4" stroke={1.7} />
              </label>
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Haz clic en la cámara para cambiar el logo</p>
          </div>

          {/* Nombre */}
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              value={editando.nombreNuevo}
              onChange={(e) => setEditando((s) => ({ ...s, nombreNuevo: e.target.value }))}
              placeholder="Nombre del proveedor"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <button onClick={guardar} disabled={guardando || !editando.nombreNuevo.trim()}
            className="h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#5C3317' }}>
            {guardando
              ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <><Icon name="check" className="w-5 h-5" stroke={2.2} />{editando.id ? 'Guardar cambios' : 'Agregar proveedor'}</>}
          </button>
        </div>
      )}

      {/* Modal eliminar proveedor frecuente */}
      {showEliminarConfirm && editando && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setShowEliminarConfirm(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">¿Eliminar proveedor?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                  Se eliminará <span className="font-medium text-gray-700 dark:text-zinc-300">{editando.nombre}</span> de los frecuentes. Los registros históricos no se borran.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEliminarConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button
                  onClick={() => { setShowEliminarConfirm(false); eliminar(editando.id) }}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
