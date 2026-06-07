import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ConfigProvider } from './hooks/useConfig'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import Spinner from './components/Spinner'

// Path crítico — carga inmediata (trabajadores lo usan siempre)
import Login from './pages/Login'
import Turno from './pages/Turno'
import Resumen from './pages/Resumen'

// Páginas admin/pesadas — carga diferida
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Historial      = lazy(() => import('./pages/Historial'))
const EditarTurno    = lazy(() => import('./pages/EditarTurno'))
const Proveedores    = lazy(() => import('./pages/Proveedores'))
const Usuarios       = lazy(() => import('./pages/Usuarios'))
const Configuracion  = lazy(() => import('./pages/Configuracion'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])
  return null
}

function LazyRoute({ children }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      {children}
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ConfigProvider>
        <ToastProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/turno" element={
            <ProtectedRoute><Turno /></ProtectedRoute>
          } />

          <Route path="/resumen" element={
            <ProtectedRoute><Resumen /></ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute solodueno>
              <LazyRoute><Dashboard /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/historial" element={
            <ProtectedRoute solodueno>
              <LazyRoute><Historial /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/turno/editar" element={
            <ProtectedRoute solodueno>
              <LazyRoute><EditarTurno /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/proveedores" element={
            <ProtectedRoute solodueno>
              <LazyRoute><Proveedores /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/usuarios" element={
            <ProtectedRoute solodueno>
              <LazyRoute><Usuarios /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/configuracion" element={
            <ProtectedRoute solodueno>
              <LazyRoute><Configuracion /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/turno" replace />} />
          <Route path="*" element={<Navigate to="/turno" replace />} />
        </Routes>
        </ToastProvider>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
