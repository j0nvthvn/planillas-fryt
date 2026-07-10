import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useErrorToast } from '../hooks/useErrorToast'

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

  useErrorToast(errorMessage)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/hoy')
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
    <div className="min-h-screen flex flex-col bg-canvas">

      <div className="flex flex-col items-center pt-14 pb-8 px-4">
        <div className="w-[104px] h-[104px] rounded-full overflow-hidden border-4 border-brand-tint mb-5 bg-brand">
          <img
            src="/logo.jpg"
            alt="Logo Minimarket Fryt"
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        <h1 className="font-display text-[34px] leading-none text-brand">
          Minimarket Fryt
        </h1>
        <p className="text-sm text-muted mt-1">FrytControl · Caja y turnos</p>

        <div className="mt-5 text-center">
          <p className="text-base font-semibold text-ink2">{saludo()}</p>
          <p className="text-sm text-muted mt-0.5" style={{ textTransform: 'capitalize' }}>{fechaHoy.toLowerCase()}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-start px-4">
        <div className="w-full max-w-sm md:max-w-md mx-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-card rounded-3xl border border-hairline p-6 space-y-4"
          >
            <p className="eyebrow mb-1">Iniciar sesión</p>

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

          <p className="text-center text-xs text-muted mt-5">
            FrytControl — Minimarket Fryt
          </p>
        </div>
      </div>

    </div>
  )
}
