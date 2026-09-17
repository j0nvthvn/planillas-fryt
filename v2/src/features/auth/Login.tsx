import { useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { iniciarSesion } from '@/lib/auth'
import { fechaLegible, hoy } from '@/lib/format'

function saludo() {
  const h = new Date().getHours()
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Login() {
  const navigate = useNavigate()
  const { volver } = useSearch({ from: '/login' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verClave, setVerClave] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await iniciarSesion(email.trim(), password)
    } catch (err) {
      const status = (err as { status?: number }).status
      setError(status === 429 ? 'Demasiados intentos. Espera un momento antes de volver a ingresar.' : 'Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }
    // El botón sigue en "Ingresando…" mientras la ruta carga el usuario:
    // antes volvía a quedar activo y la pantalla parecía no responder.
    // Solo rutas internas ("/x", nunca "//dominio").
    const destino = volver && /^\/(?!\/)/.test(volver) && volver !== '/login' ? volver : '/hoy'
    await navigate({ to: destino as '/hoy' }).finally(() => setLoading(false))
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <div className="flex flex-col items-center pt-14 pb-8 px-4">
        <div className="w-[88px] h-[88px] rounded-[16px] overflow-hidden border border-hairline shadow-card mb-5 bg-card">
          <img src="/logo.jpg" alt="Logo Minimarket Fryt" className="w-full h-full object-cover" />
        </div>
        <h1 className="font-display text-2xl font-semibold leading-[1.1] tracking-[-0.025em] text-ink">Minimarket Fryt</h1>
        <p className="text-sm text-muted mt-1">FrytControl · Caja y turnos</p>
        <div className="mt-5 text-center">
          <p className="text-base font-semibold text-ink2">{saludo()}</p>
          <p className="text-sm text-muted mt-0.5">{fechaLegible(hoy())}</p>
        </div>
      </div>
      <div className="flex-1 px-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm mx-auto card space-y-4">
          <p className="eyebrow">Iniciar sesión</p>
          <div>
            <label className="label" htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" aria-invalid={error ? true : undefined} aria-describedby={error ? 'login-error' : undefined} />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <div className="relative">
              <input id="password" type={verClave ? 'text' : 'password'} className="input pr-12" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" aria-invalid={error ? true : undefined} aria-describedby={error ? 'login-error' : undefined} />
              <button type="button" onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={verClave}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-[10px] text-ink2 hover:bg-soft">
                <Icon name={verClave ? 'eyeOff' : 'eye'} className="w-5 h-5" />
              </button>
            </div>
          </div>
          {error && <p id="login-error" role="alert" className="text-sm text-neg font-medium">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
