import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [usuario, setUsuario] = useState(null)
  const [loadingUsuario, setLoadingUsuario] = useState(false)
  const [authError, setAuthError] = useState('')
  const loadedUsuarioId = useRef(null)
  const usuarioRequest = useRef(0)

  useEffect(() => {
    let active = true
    let fetchTimer

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setSession(session)

      if (!session) {
        loadedUsuarioId.current = null
        usuarioRequest.current += 1
        setUsuario(null)
        setLoadingUsuario(false)
        setAuthError('')
        return
      }

      if (loadedUsuarioId.current !== session.user.id) {
        setLoadingUsuario(true)
        clearTimeout(fetchTimer)
        fetchTimer = setTimeout(() => fetchUsuario(session.user.id), 0)
      }
    })

    return () => {
      active = false
      clearTimeout(fetchTimer)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchUsuario(id) {
    const request = ++usuarioRequest.current
    setLoadingUsuario(true)

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      if (request !== usuarioRequest.current) return

      loadedUsuarioId.current = id
      setUsuario(data)
      setAuthError(data ? '' : 'Tu cuenta no tiene un perfil habilitado. Contacta al administrador.')
    } catch (error) {
      if (request !== usuarioRequest.current) return

      loadedUsuarioId.current = null
      setUsuario(null)
      setAuthError('No se pudo cargar tu perfil. Inténtalo nuevamente.')
      console.error('No se pudo cargar el perfil del usuario:', error)
    } finally {
      if (request === usuarioRequest.current) setLoadingUsuario(false)
    }
  }

  async function signIn(email, password) {
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    usuario,
    loading: session === undefined,
    loadingUsuario,
    authError,
    esDueno: usuario?.rol === 'dueño',
    signIn,
    signOut,
    refetchUsuario: () => session && fetchUsuario(session.user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
