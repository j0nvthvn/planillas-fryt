import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function saludo() {
  const h = new Date().getHours()
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const fechaHoy = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date())

export default function Login() {
  const { authError, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const errorMessage = error || authError

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/turno')
    } catch (err) {
      setError(
        err?.status === 429
          ? 'Hay demasiados intentos. Espera un momento antes de volver a ingresar.'
          : 'Correo o contraseña incorrectos.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF6EC] dark:bg-zinc-950">

      {/* ── Cabecera de marca ──────────────────────────── */}
      <div className="flex flex-col items-center pt-14 pb-8 px-4">
        <div className="w-28 h-28 rounded-full overflow-hidden border-4 shadow-md mb-5 border-brand dark:border-brand-tint">
          <img
            src="/logo.jpg"
            alt="Logo Minimarket Fryt"
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-brand dark:text-[#E8C9A8]">
          Minimarket Fryt
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Planilla de Caja</p>

        <div className="mt-5 text-center">
          <p className="text-base font-semibold text-gray-700 dark:text-zinc-300">{saludo()}</p>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5" style={{ textTransform: 'capitalize' }}>{fechaHoy.toLowerCase()}</p>
        </div>
      </div>

      {/* ── Formulario ────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-start px-4">
        <div className="w-full max-w-sm md:max-w-md mx-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-[#EDE0C8] dark:border-zinc-700 p-6 space-y-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-1">
              Iniciar sesión
            </p>

            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="correo@ejemplo.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base gap-2"
            >
              {loading && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 dark:text-zinc-500 mt-5">
            Minimarket Fryt · Sistema interno
          </p>
        </div>
      </div>

    </div>
  )
}
