import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders as cors } from '../_shared/cors.ts'

const LARGO_MINIMO = 10

Deno.serve(async (req) => {
  const corsHeaders = cors(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Solo el dueño puede llamar esta función (verificado via JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Sin autorización' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente con service role para poder crear usuarios en Auth
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar que quien llama es dueño
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: perfil } = await supabaseAdmin
      .from('usuarios').select('rol, activo').eq('id', user.id).single()
    if (perfil?.rol !== 'dueño' || !perfil.activo) {
      return new Response(JSON.stringify({ error: 'Solo el dueño puede crear usuarios' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { nombre, email, password } = await req.json()
    if (!nombre?.trim() || !email?.trim() || !password || password.length < LARGO_MINIMO) {
      return new Response(JSON.stringify({ error: `Datos incompletos o contraseña de menos de ${LARGO_MINIMO} caracteres` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Crear en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    })
    if (authError) {
      const msg = authError.message.includes('already registered')
        ? 'Ya existe un usuario con ese correo.'
        : authError.message
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Insertar perfil en tabla usuarios
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      nombre: nombre.trim(),
      email: email.trim(),
      rol: 'trabajador',
    })
    if (dbError) {
      // Rollback: eliminar usuario de Auth si falla la inserción
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    return new Response(JSON.stringify({ ok: true, nombre: nombre.trim() }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
