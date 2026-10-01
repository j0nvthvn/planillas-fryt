import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders as cors } from '../_shared/cors.ts'

// Activa o desactiva una cuenta. Además de usuarios.activo (que la base
// usa en RLS vía es_miembro_activo), banea o desbanea al usuario en Auth:
// así una cuenta desactivada no puede iniciar sesión ni renovar su token.
// Body: { id: uuid, activo: boolean }. Solo un dueño activo, y nunca
// sobre su propia cuenta (no se puede dejar el local sin dueña).

const BAN_PERMANENTE = '876000h' // ~100 años

Deno.serve(async (req) => {
  const corsHeaders = cors(req)
  const json = (cuerpo: unknown, status: number) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Sin autorización' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return json({ error: 'Token inválido' }, 401)

    const { data: perfil } = await supabaseAdmin
      .from('usuarios').select('rol, activo').eq('id', user.id).single()
    if (perfil?.rol !== 'dueño' || !perfil.activo) {
      return json({ error: 'Solo el dueño puede activar o desactivar cuentas' }, 403)
    }

    const { id, activo } = await req.json() as { id?: string; activo?: boolean }
    if (typeof id !== 'string' || typeof activo !== 'boolean') {
      return json({ error: 'Datos incompletos' }, 400)
    }
    if (id === user.id) return json({ error: 'No puedes desactivar tu propia cuenta' }, 400)

    const { data: objetivo } = await supabaseAdmin.from('usuarios').select('id').eq('id', id).maybeSingle()
    if (!objetivo) return json({ error: 'La cuenta no existe' }, 404)

    // Primero Auth: si el baneo falla, la fila no queda "inactiva" con
    // la sesión todavía viva.
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: activo ? 'none' : BAN_PERMANENTE,
    })
    if (authError) throw authError

    const { error: dbError } = await supabaseAdmin.from('usuarios').update({ activo }).eq('id', id)
    if (dbError) throw dbError

    return json({ ok: true, activo }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: 'Error interno del servidor' }, 500)
  }
})
