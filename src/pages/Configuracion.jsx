import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Icon from '../components/Icon'
import { useConfig } from '../hooks/useConfig'
import { useTheme } from '../hooks/useTheme'

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

export default function Configuracion() {
  const { config, guardar } = useConfig()
  const { tema, setTema } = useTheme()
  const [diasUnicos, setDiasUnicos] = useState(config.diasTurnoUnico)
  const [horaCorte, setHoraCorte] = useState(String(config.horaCorteManana))
  const [notifActivas, setNotifActivas] = useState(config.notificacionesActivas)
  const [notifEmailExtra, setNotifEmailExtra] = useState(config.notificacionesEmailExtra)
  const [nombreLocal, setNombreLocal] = useState(config.nombreLocal)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDiasUnicos(config.diasTurnoUnico)
    setHoraCorte(String(config.horaCorteManana))
    setNotifActivas(config.notificacionesActivas)
    setNotifEmailExtra(config.notificacionesEmailExtra)
    setNombreLocal(config.nombreLocal)
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
    setGuardando(true)
    setError('')
    const { error: err } = await guardar({
      diasTurnoUnico: diasUnicos,
      horaCorteManana: hora,
      notificacionesActivas: notifActivas,
      notificacionesEmailExtra: notifEmailExtra.trim(),
      nombreLocal: nombreLocal.trim() || 'Fryt',
    })
    setGuardando(false)
    if (err) setError('No se pudo guardar. Inténtalo de nuevo.')
    else setGuardado(true)
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Configuración</h1>

        {/* Apariencia — local, no se guarda en Supabase */}
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Apariencia</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Se guarda en este dispositivo, no afecta a otros usuarios.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TEMAS.map(({ value, label, icon }) => {
              const activo = tema === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTema(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-colors ${
                    activo
                      ? 'bg-brand-tint border-brand text-brand'
                      : 'bg-gray-50 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-600'
                  }`}
                >
                  <Icon name={icon} className="w-5 h-5" stroke={activo ? 2.2 : 1.8} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Nombre del local */}
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Nombre del local</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Aparece en el encabezado y en los reportes por email.</p>
          </div>
          <input
            type="text"
            value={nombreLocal}
            onChange={(e) => { setNombreLocal(e.target.value); setGuardado(false) }}
            placeholder="Ej: Minimarket Fryt"
            className="input"
            maxLength={40}
          />
        </div>

        {/* Días de turno único */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Días con un solo turno</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">En estos días solo se registra el turno de mañana.</p>
          </div>
          <div className="space-y-1">
            {DIAS.map(({ idx, label }) => {
              const activo = diasUnicos.includes(idx)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDia(idx)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors ${
                    activo ? 'bg-brand-tint' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className={`font-medium ${activo ? 'text-brand' : 'text-gray-700 dark:text-zinc-300'}`}>{label}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${activo ? 'text-brand' : 'text-gray-400 dark:text-zinc-500'}`}>
                    {activo ? (
                      <>
                        <Icon name="sun" className="w-3.5 h-3.5" /> Solo mañana
                      </>
                    ) : (
                      <>
                        <Icon name="check" className="w-3.5 h-3.5" stroke={2} /> 2 turnos
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Hora de corte */}
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Hora de corte mañana / tarde</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Antes de esta hora el turno se sugiere como "mañana", después como "tarde".
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={23}
              value={horaCorte}
              onChange={(e) => { setHoraCorte(e.target.value); setGuardado(false) }}
              className="input w-24 text-center text-lg font-semibold"
            />
            <span className="text-sm text-gray-500 dark:text-zinc-400">horas (formato 24h)</span>
          </div>
        </div>

        {/* Notificaciones por email */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Notificaciones por email</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Resúmenes automáticos al guardar un turno y reportes diarios/semanales al dueño.
            </p>
          </div>

          {/* Toggle activar */}
          <button
            type="button"
            onClick={() => { setNotifActivas((v) => !v); setGuardado(false) }}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors ${
              notifActivas ? 'bg-brand-tint' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
            }`}
          >
            <span className={`font-medium ${notifActivas ? 'text-brand' : 'text-gray-700 dark:text-zinc-300'}`}>
              Notificaciones activas
            </span>
            <span className={`w-10 h-6 rounded-full relative transition-colors ${notifActivas ? 'bg-brand' : 'bg-gray-200 dark:bg-zinc-600'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${notifActivas ? 'left-5' : 'left-1'}`} />
            </span>
          </button>

          {/* Email extra */}
          {notifActivas && (
            <div className="space-y-1.5">
              <label className="label">Email adicional <span className="font-normal text-gray-400 dark:text-zinc-500">(opcional)</span></label>
              <input
                type="email"
                placeholder="contador@ejemplo.com"
                value={notifEmailExtra}
                onChange={(e) => { setNotifEmailExtra(e.target.value); setGuardado(false) }}
                className="input"
              />
              <p className="text-xs text-gray-400 dark:text-zinc-500">Ej: contador o socio que también recibe los resúmenes.</p>
            </div>
          )}

          {/* Qué se envía */}
          {notifActivas && (
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Qué recibirás</p>
              {[
                'Resumen inmediato al guardar cada turno',
                'Resumen diario automático a las 23:00',
                'Resumen semanal los lunes a las 8:00',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Icon name="check" className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" stroke={2.5} />
                  <span className="text-xs text-gray-600 dark:text-zinc-300">{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          className="btn-primary w-full py-3 gap-2"
        >
          {guardando && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>

        {guardado && (
          <p className="text-center text-sm text-green-700 font-medium">
            ✓ Configuración guardada correctamente
          </p>
        )}
      </div>
    </Layout>
  )
}
