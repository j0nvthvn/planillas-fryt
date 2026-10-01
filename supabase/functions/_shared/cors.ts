// CORS de las funciones que llama la app con la sesión del usuario
// (crear-usuario, desactivar-usuario). Solo se responde al origen de la
// app, a sus previews de Vercel y al servidor de desarrollo; el resto
// recibe el origen de producción, que el navegador rechaza.

const PRODUCCION = 'https://app.frytspa.cl'
const PERMITIDOS = [
  /^https:\/\/app\.frytspa\.cl$/,
  /^https:\/\/frytcontrol-v2(-[a-z0-9-]+)?\.vercel\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
]

export function corsHeaders(req: Request): Record<string, string> {
  const origen = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': PERMITIDOS.some((r) => r.test(origen)) ? origen : PRODUCCION,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}
