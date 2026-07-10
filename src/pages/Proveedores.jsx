import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import IconButton from '../components/IconButton'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { useErrorToast } from '../hooks/useErrorToast'
import { ProveedorAvatar } from '../components/TurnoInput'

export default function Proveedores() {
  const { esDueno } = useAuth()
  const navigate = useNavigate()
  const [proveedores, setProveedores] = useState([])
  const [stats, setStats] = useState({})
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [showEliminarConfirm, setShowEliminarConfirm] = useState(false)

  useErrorToast(error)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const [{ data: frecs }, { data: hist }] = await Promise.all([
      supabase.from('proveedores_frecuentes').select('id, nombre, imagen_url').order('nombre'),
      supabase.from('proveedores_turno').select('nombre, monto'),
    ])
    const counts = {}
    for (const r of hist || []) {
      counts[r.nombre] = counts[r.nombre] || { n: 0, total: 0 }
      counts[r.nombre].n += 1
      counts[r.nombre].total += Number(r.monto) || 0
    }
    setStats(counts)
    setProveedores(frecs || [])
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
        const nombreNuevo = editando.nombreNuevo.trim()
        const nombreCambio = nombreNuevo !== editando.nombre
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
          throw new Error('No se pudo guardar: falta una política UPDATE en la tabla proveedores_frecuentes.')
        }
        setProveedores((prev) => prev.map((p) =>
          p.id === editando.id ? { ...p, nombre: nombreNuevo, imagen_url } : p
        ))
      } else {
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
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"
        >
          <Icon name="arrowLeft" className="w-4 h-4" stroke={2} />
          Volver
        </button>

        <PageHeader
          title="Proveedores"
          action={esDueno && (
            <IconButton icon="plus" stroke={2.2} label="Nuevo proveedor" onClick={abrirNuevo} />
          )}
        />

        {proveedores.length === 0 && (
          <div className="card text-center text-muted py-12">
            Todavía no hay proveedores frecuentes.<br />
            <span className="text-sm">Agrega uno o guarda turnos con proveedores.</span>
          </div>
        )}

        <div className="space-y-2.5">
          {proveedores.map((p) => {
            const s = stats[p.nombre] || { n: 0, total: 0 }
            return (
              <button
                key={p.id}
                onClick={() => abrirEditar(p)}
                className="w-full rounded-2xl bg-card border border-hairline p-3.5 flex items-center gap-3 text-left hover:border-brand/30 hover:shadow-card transition-all"
              >
                <ProveedorAvatar nombre={p.nombre} imagen_url={p.imagen_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink truncate">{p.nombre}</p>
                  <p className="text-[12px] text-muted mt-0.5">
                    {s.n} {s.n === 1 ? 'compra' : 'compras'} · ${s.total.toLocaleString('es-CL')}
                  </p>
                </div>
                <Icon name="chevR" className="w-4 h-4 text-muted2 shrink-0" />
              </button>
            )
          })}
        </div>
      </div>

      {editando && <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={() => setEditando(null)} />}

      {editando && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-canvas rounded-t-[30px] px-5 pt-3 pb-10 max-h-[92%] overflow-y-auto flex flex-col gap-4 safe-bottom md:inset-x-auto md:left-1/2 md:bottom-auto md:top-[8vh] md:w-[440px] md:rounded-3xl md:max-h-[80vh]"
          style={{ boxShadow: '0 -22px 55px -22px rgba(0,0,0,.45)' }}>
          <div className="w-10 h-1 rounded-full bg-hairline mx-auto" />

          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-ink">
              {editando.id ? 'Editar proveedor' : 'Nuevo proveedor'}
            </h3>
            <div className="flex gap-2">
              {editando.id && (
                <button onClick={() => setShowEliminarConfirm(true)}
                  className="w-8 h-8 rounded-full grid place-items-center bg-hairline text-neg">
                  <Icon name="trash" className="w-[18px] h-[18px]" />
                </button>
              )}
              <button onClick={() => setEditando(null)}
                className="w-8 h-8 rounded-full grid place-items-center bg-hairline text-ink2">
                <Icon name="close" className="w-[15px] h-[15px]" stroke={2.2} />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <ProveedorAvatar nombre={editando.nombreNuevo || 'P'} imagen_url={editando.preview} size="lg" />
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card border border-hairline shadow grid place-items-center cursor-pointer text-ink2 hover:text-brand transition">
                <input type="file" accept="image/*" className="sr-only" onChange={handlePickImage} />
                <Icon name="camera" className="w-4 h-4" stroke={1.7} />
              </label>
            </div>
            <p className="text-xs text-muted2">Haz clic en la cámara para cambiar el logo</p>
          </div>

          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              value={editando.nombreNuevo}
              onChange={(e) => setEditando((s) => ({ ...s, nombreNuevo: e.target.value }))}
              placeholder="Nombre del proveedor"
            />
          </div>

          <button onClick={guardar} disabled={guardando || !editando.nombreNuevo.trim()}
            className="btn-primary py-3 disabled:opacity-50 gap-2">
            {guardando
              ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <><Icon name="check" className="w-5 h-5" stroke={2.2} />{editando.id ? 'Guardar cambios' : 'Agregar proveedor'}</>}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showEliminarConfirm && !!editando}
        title="¿Eliminar proveedor?"
        description={<>Se eliminará <span className="font-medium text-ink">{editando?.nombre}</span> de los frecuentes. Los registros históricos no se borran.</>}
        confirmLabel="Eliminar"
        danger
        zIndex={60}
        onCancel={() => setShowEliminarConfirm(false)}
        onConfirm={() => { setShowEliminarConfirm(false); eliminar(editando.id) }}
      />
    </Layout>
  )
}
