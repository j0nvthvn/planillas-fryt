import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import { useConfig } from '../hooks/useConfig'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../components/Toast'
import { useErrorToast } from '../hooks/useErrorToast'

const DIAS = [
  { idx: 1, label: 'Lunes' },
  { idx: 2, label: 'Martes' },
  { idx: 3, label: 'Miércoles' },
  { idx: 4, label: 'Jueves' },
  { idx: 5, label: 'Viernes' },
  { idx: 6, label: 'Sábado' },
  { idx: 0, label: 'Domingo' },
]

const TEMAS = [
  { value: 'claro',   label: 'Claro',    icon: 'sun' },
  { value: 'sistema', label: 'Sistema',  icon: 'settings' },
  { value: 'oscuro',  label: 'Oscuro',   icon: 'moon' },
]

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        // Algunos usos envuelven el Toggle en una fila con su propio onClick
        // (tap target más grande). Frenamos la propagación para que el click
        // en el switch no dispare doblemente el mismo cambio.
        e.stopPropagation()
        onChange()
      }}
      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
        on ? 'bg-brand' : 'bg-hairline'
      }`}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all"
        style={{ left: on ? '22px' : '2px' }}
      />
    </button>
  )
}

function SettingRow({ children, onClick, last = false }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3.5 ${last ? '' : 'border-b border-soft'} ${onClick ? 'cursor-pointer hover:bg-canvas' : ''}`}
    >
      {children}
    </div>
  )
}

export default function Configuracion() {
  const navigate = useNavigate()
  const { config, guardar } = useConfig()
  const { tema, setTema } = useTheme()
  const toast = useToast()
  const [diasUnicos, setDiasUnicos] = useState(config.diasTurnoUnico)
  const [horaCorte, setHoraCorte] = useState(String(config.horaCorteManana))
  const [notifActivas, setNotifActivas] = useState(config.notificacionesActivas)
  const [notifEmailExtra, setNotifEmailExtra] = useState(config.notificacionesEmailExtra)
  const [nombreLocal, setNombreLocal] = useState(config.nombreLocal)
  const [fondoCaja, setFondoCaja] = useState(String(config.fondoCajaInicial ?? 0))
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  useErrorToast(error)

  useEffect(() => {
    if (!guardado) return
    const id = toast.show({ message: 'Configuración guardada correctamente', duration: 4000 })
    return () => toast.hide(id)
  }, [guardado, toast])

  useEffect(() => {
    setDiasUnicos(config.diasTurnoUnico)
    setHoraCorte(String(config.horaCorteManana))
    setNotifActivas(config.notificacionesActivas)
    setNotifEmailExtra(config.notificacionesEmailExtra)
    setNombreLocal(config.nombreLocal)
    setFondoCaja(String(config.fondoCajaInicial ?? 0))
  }, [config])

  function toggleDia(idx) {
    setDiasUnicos((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    )
    setGuardado(false)
  }

  async function handleGuardar() {
    const hora = parseInt(horaCorte, 10)
    if (isNaN(hora) || hora < 0 || hora > 23) {
      setError('La hora debe estar entre 0 y 23.')
      return
    }
    const fondo = parseInt(fondoCaja, 10)
    if (isNaN(fondo) || fondo < 0) {
      setError('El fondo de caja debe ser un monto válido.')
      return
    }
    setGuardando(true)
    setError('')
    const { error: err } = await guardar({
      diasTurnoUnico: diasUnicos,
      horaCorteManana: hora,
      notificacionesActivas: notifActivas,
      notificacionesEmailExtra: notifEmailExtra.trim(),
      nombreLocal: nombreLocal.trim() || 'Fryt',
      fondoCajaInicial: fondo,
    })
    setGuardando(false)
    if (err) setError('No se pudo guardar. Inténtalo de nuevo.')
    else setGuardado(true)
  }

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

        <PageHeader title="Configuración" />

        {/* Local */}
        <section>
          <p className="eyebrow px-1 mb-2">Local</p>
          <div className="rounded-2xl bg-card border border-hairline overflow-hidden">
            <div className="px-4 py-3.5 border-b border-soft">
              <label className="block text-[13px] font-semibold text-ink mb-1.5">Nombre del local</label>
              <input
                type="text"
                value={nombreLocal}
                onChange={(e) => { setNombreLocal(e.target.value); setGuardado(false) }}
                placeholder="Minimarket Fryt"
                className="w-full bg-transparent border-0 p-0 text-[14px] text-ink2 focus:outline-none focus:ring-0"
                maxLength={40}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-soft">
              <span className="text-[14px] text-ink">Hora de corte mañana</span>
              <input
                type="number"
                min={0}
                max={23}
                value={horaCorte}
                onChange={(e) => { setHoraCorte(e.target.value); setGuardado(false) }}
                className="w-16 text-right bg-transparent border-0 p-0 text-[14px] font-semibold text-ink2 focus:outline-none focus:ring-0 tabular-nums"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-[14px] text-ink">Fondo de caja inicial</p>
                <p className="text-[12px] text-muted mt-0.5">Vuelto con el que se abre cada turno nuevo</p>
              </div>
              <input
                type="number"
                min={0}
                step={100}
                value={fondoCaja}
                onChange={(e) => { setFondoCaja(e.target.value); setGuardado(false) }}
                className="w-24 text-right bg-transparent border-0 p-0 text-[14px] font-semibold text-ink2 focus:outline-none focus:ring-0 tabular-nums"
              />
            </div>
          </div>
        </section>

        {/* Días turno único */}
        <section>
          <p className="eyebrow px-1 mb-2">Días con turno único</p>
          <div className="rounded-2xl bg-card border border-hairline overflow-hidden">
            {DIAS.map(({ idx, label }, i) => {
              const activo = diasUnicos.includes(idx)
              return (
                <div
                  key={idx}
                  onClick={() => toggleDia(idx)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-canvas transition-colors ${
                    i === DIAS.length - 1 ? '' : 'border-b border-soft'
                  }`}
                >
                  <span className="text-[14px] text-ink">{label}</span>
                  <Toggle on={activo} onChange={() => toggleDia(idx)} label={`Turno único los ${label.toLowerCase()}`} />
                </div>
              )
            })}
          </div>
        </section>

        {/* Apariencia */}
        <section>
          <p className="eyebrow px-1 mb-2">Apariencia</p>
          <div className="rounded-2xl bg-card border border-hairline p-1.5">
            <div className="flex gap-1">
              {TEMAS.map(({ value, label, icon }) => {
                const activo = tema === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTema(value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-[10px] text-[12px] font-semibold transition-colors ${
                      activo
                        ? 'bg-brand-tint text-brand'
                        : 'text-ink2 hover:bg-canvas'
                    }`}
                  >
                    <Icon name={icon} className="w-4 h-4" stroke={activo ? 2.2 : 1.8} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* Notificaciones */}
        <section>
          <p className="eyebrow px-1 mb-2">Notificaciones</p>
          <div className="rounded-2xl bg-card border border-hairline overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-ink">Notificaciones activas</p>
                <p className="text-[12px] text-muted mt-0.5">Resúmenes al guardar y reportes diarios</p>
              </div>
              <Toggle
                on={notifActivas}
                onChange={() => { setNotifActivas((v) => !v); setGuardado(false) }}
                label="Notificaciones activas"
              />
            </div>
            {notifActivas && (
              <>
                <div className="border-t border-soft px-4 py-3.5">
                  <label className="block text-[13px] font-semibold text-ink mb-1.5">Email adicional</label>
                  <input
                    type="email"
                    placeholder="contador@ejemplo.com"
                    value={notifEmailExtra}
                    onChange={(e) => { setNotifEmailExtra(e.target.value); setGuardado(false) }}
                    className="w-full bg-transparent border-0 p-0 text-[14px] text-ink2 placeholder-muted2 focus:outline-none focus:ring-0"
                  />
                </div>
                <div className="border-t border-soft bg-canvas px-4 py-3 space-y-1.5">
                  <p className="eyebrow mb-2">Qué recibirás</p>
                  {[
                    'Resumen inmediato al guardar cada turno',
                    'Resumen diario automático a las 23:00',
                    'Resumen semanal los lunes a las 8:00',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <Icon name="check" className="w-3.5 h-3.5 text-pos shrink-0 mt-0.5" stroke={2.5} />
                      <span className="text-[12px] text-ink2">{item}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          className="btn-primary w-full py-3 gap-2"
        >
          {guardando && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Layout>
  )
}
