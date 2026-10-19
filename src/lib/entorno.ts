/**
 * Entorno de la build: `--mode staging` (`pnpm dev --mode staging` y las
 * previews de Vercel) apunta a la base de staging. Producción no lleva marca.
 */
export const ES_STAGING = import.meta.env.MODE === 'staging'
