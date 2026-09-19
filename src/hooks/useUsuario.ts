import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import { useSession, type Usuario } from '@/lib/auth'

/** Perfil (usuarios) del usuario con sesión; `esDueno` decide qué se ve. */
export function useUsuario() {
  const session = useSession()
  const id = session?.user.id
  const q = useQuery({
    queryKey: qk.usuario(id ?? 'anon'),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<Usuario | null> => {
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
  return {
    session,
    usuario: q.data ?? null,
    esDueno: q.data?.rol === 'dueño',
    cargando: session === undefined || (!!id && q.isPending),
  }
}
