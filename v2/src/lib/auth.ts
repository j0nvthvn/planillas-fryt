import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { queryClient, qk } from './query'
import type { Tables } from './database.types'

export type Usuario = Tables<'usuarios'>

/**
 * Sesión como store externo (fuera de React) para que el router pueda
 * decidir redirecciones en `beforeLoad` y los componentes la lean con
 * useSyncExternalStore sin un provider intermedio.
 */
let session: Session | null | undefined = undefined
const listeners = new Set<() => void>()
function notify() { for (const l of listeners) l() }

const listo = supabase.auth.getSession().then(({ data }) => {
  if (session === undefined) { session = data.session; notify() }
})

supabase.auth.onAuthStateChange((_evento, s) => {
  const cambioUsuario = s?.user.id !== session?.user.id
  session = s
  notify()
  if (cambioUsuario) {
    // Nada de lo cacheado pertenece al nuevo usuario (o a ninguno).
    queryClient.clear()
  }
})

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, () => session, () => session)
}

export async function esperarSesion(): Promise<Session | null> {
  await listo
  return session ?? null
}

export async function cargarUsuario(id: string): Promise<Usuario | null> {
  return queryClient.ensureQueryData({
    queryKey: qk.usuario(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })
}

export async function iniciarSesion(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
}
