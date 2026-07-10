import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ConfigProvider } from './hooks/useConfig'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import Spinner from './components/Spinner'

// Path crítico — carga inmediata
import Login from './pages/Login'
import Hoy from './pages/Hoy'
import Turno from './pages/Turno'

// Páginas admin/pesadas — carga diferida
const Analisis      = lazy(() => import('./pages/Analisis'))
const Historial     = lazy(() => import('./pages/Historial'))
const Resumen       = lazy(() => import('./pages/Resumen'))
const EditarTurno   = lazy(() => import('./pages/EditarTurno'))
const Proveedores   = lazy(() => import('./pages/Proveedores'))
const Usuarios      = lazy(() => import('./pages/Usuarios'))
const Configuracion = lazy(() => import('./pages/Configuracion'))
const Papelera       = lazy(() => import('./pages/Papelera'))
const ProveedorDetalle = lazy(() => import('./pages/ProveedorDetalle'))
const RegistroErrores  = lazy(() => import('./pages/RegistroErrores'))

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

          <Route path="/hoy" element={
            <ProtectedRoute><Hoy /></ProtectedRoute>
          } />

          <Route path="/turno" element={
            <ProtectedRoute><Turno /></ProtectedRoute>
          } />

          <Route path="/resumen" element={
            <ProtectedRoute><LazyRoute><Resumen /></LazyRoute></ProtectedRoute>
          } />

          <Route path="/analisis" element={
            <ProtectedRoute solodueno>
              <LazyRoute><Analisis /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={<Navigate to="/analisis" replace />} />

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

          <Route path="/papelera" element={
            <ProtectedRoute solodueno>
              <LazyRoute><Papelera /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/proveedor" element={
            <ProtectedRoute solodueno>
              <LazyRoute><ProveedorDetalle /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/errores" element={
            <ProtectedRoute solodueno>
              <LazyRoute><RegistroErrores /></LazyRoute>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/hoy" replace />} />
          <Route path="*" element={<Navigate to="/hoy" replace />} />
        </Routes>
        </ToastProvider>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
