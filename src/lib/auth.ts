import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { queryClient, qk } from './query'
import type { Tables } from './database.types'
import { debeLimpiarCache } from './sesion'

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

let ultimoUsuarioId: string | null | undefined = undefined

supabase.auth.onAuthStateChange((_evento, s) => {
  const nuevo = s?.user.id ?? null
  const limpiar = debeLimpiarCache(ultimoUsuarioId, nuevo)
  ultimoUsuarioId = nuevo
  session = s
  notify()
  if (limpiar) queryClient.clear()
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

/**
 * Solo borra la sesión de este dispositivo: no espera a la red, así que
 * sale al instante aun sin conexión. SIGNED_OUT limpia la caché y
 * RequiereSesion lleva a /login al ver la sesión en null.
 */
export async function cerrarSesion() {
  await supabase.auth.signOut({ scope: 'local' })
}
