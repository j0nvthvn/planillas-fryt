import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Spinner from './Spinner'

export default function ProtectedRoute({ children, solodueno = false }) {
  const { loading, loadingUsuario, session, usuario, esDueno } = useAuth()

  if (loading) return <Spinner className="min-h-screen" />
  if (!session) return <Navigate to="/login" replace />
  if (loadingUsuario) return <Spinner className="min-h-screen" />
  if (!usuario) return <Navigate to="/login" replace />
  if (solodueno && !esDueno) return <Navigate to="/turno" replace />

  return children
}
