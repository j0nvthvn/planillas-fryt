import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import Badge from '../components/Badge'
import { ProveedorAvatar } from '../components/TurnoInput'
import { supabase } from '../lib/supabase'
import { clp, fechaCorta } from '../utils/format'

export default function ProveedorDetalle() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nombre = params.get('nombre') || ''
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [compras, setCompras] = useState([])
  const [imagenUrl, setImagenUrl] = useState('')

  useEffect(() => {
    if (!nombre) { setCargando(false); return }
    cargar()
  }, [nombre])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const [{ data: pagos, error: errPagos }, { data: frecuente }] = await Promise.all([
        supabase
          .from('proveedores_turno')
          .select(`
            monto, forma_pago,
            turno:turnos!inner(tipo, deleted_at, jornada:jornadas(fecha))
          `)
          .eq('nombre', nombre)
          .is('turno.deleted_at', null),
        supabase.from('proveedores_frecuentes').select('imagen_url').eq('nombre', nombre).maybeSingle(),
      ])
      if (errPagos) throw errPagos
      setImagenUrl(frecuente?.imagen_url || '')
      const filas = (pagos || [])
        .filter((p) => p.turno?.jornada?.fecha)
        .map((p) => ({
          fecha: p.turno.jornada.fecha,
          tipo: p.turno.tipo,
          monto: +p.monto,
          forma_pago: p.forma_pago,
        }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
      setCompras(filas)
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar el historial de este proveedor.')
    } finally {
      setCargando(false)
    }
  }

  const totalGastado = compras.reduce((s, c) => s + c.monto, 0)
  const promedioPorVisita = compras.length ? totalGastado / compras.length : 0
  const montoMasAlto = compras.length ? Math.max(...compras.map((c) => c.monto)) : 0

  // Frecuencia: promedio de días entre compras consecutivas (fechas
  // distintas). Con una sola fecha no hay intervalo que promediar.
  const fechasUnicas = [...new Set(compras.map((c) => c.fecha))].sort()
  let frecuenciaDias = null
  if (fechasUnicas.length >= 2) {
    let sumaDias = 0
    for (let i = 1; i < fechasUnicas.length; i++) {
      const a = new Date(fechasUnicas[i - 1] + 'T12:00:00')
      const b = new Date(fechasUnicas[i] + 'T12:00:00')
      sumaDias += Math.round((b - a) / 86_400_000)
    }
    frecuenciaDias = Math.round(sumaDias / (fechasUnicas.length - 1))
  }

  if (!nombre) {
    return (
      <Layout>
        <div className="card text-center text-muted py-12">
          Proveedor no especificado. Accede desde Análisis.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-lg md:max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate('/analisis')}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink -ml-1"
        >
          <Icon name="arrowLeft" className="w-4 h-4" stroke={2} />
          Volver
        </button>

        <div className="flex items-center gap-3">
          <ProveedorAvatar nombre={nombre} imagen_url={imagenUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-[26px] text-ink truncate">{nombre}</h1>
            <p className="text-sm text-muted">Historial de compras</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-neg-tint border border-neg/30 px-4 py-3 text-sm text-neg">
            {error}
          </div>
        )}

        {cargando && <Spinner className="py-16" />}

        {!cargando && !error && compras.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-sm text-muted">Sin compras registradas a este proveedor.</p>
          </div>
        )}

        {!cargando && compras.length > 0 && (
          <>
            <div className="card-hero">
              <p className="eyebrow">Total gastado</p>
              <p className="font-display tabular-nums text-[40px] leading-none text-ink mt-1">{clp(totalGastado)}</p>
              <p className="text-[12px] text-muted mt-2">
                {compras.length} {compras.length === 1 ? 'compra registrada' : 'compras registradas'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl p-3 border border-hairline bg-card">
                <p className="eyebrow mb-1.5 text-muted">Promedio por visita</p>
                <p className="font-display tabular-nums text-[17px] leading-none text-ink">{clp(promedioPorVisita)}</p>
              </div>
              <div className="rounded-2xl p-3 border border-hairline bg-card">
                <p className="eyebrow mb-1.5 text-muted">Frecuencia</p>
                <p className="font-display tabular-nums text-[17px] leading-none text-ink">
                  {frecuenciaDias != null ? `cada ${frecuenciaDias} días` : '—'}
                </p>
              </div>
            </div>

            <div className="card">
              <p className="font-semibold text-ink text-[15px] mb-3">Últimas compras</p>
              <div className="space-y-2">
                {compras.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink capitalize">
                        {fechaCorta(c.fecha)} · turno {c.tipo}
                      </p>
                      <p className="text-[11px] text-muted2 capitalize">{c.forma_pago}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.monto === montoMasAlto && compras.length > 1 && (
                        <Badge tone="warn">más alto</Badge>
                      )}
                      <span className="font-display tabular-nums text-[15px] text-ink">{clp(c.monto)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
