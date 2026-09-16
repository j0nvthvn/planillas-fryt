import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * Red de seguridad para lo que el compilador no ve: dependencias de efectos
 * (useTurnoForm tiene casi toda la lógica del cierre), promesas sin await y
 * exports que rompen el hot reload.
 */
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'playwright-report', 'test-results', 'src/lib/database.types.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, reactHooks.configs.flat['recommended-latest']],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // El código usa `void promesa` a propósito para no bloquear la interfaz.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // El formulario de cierre usa el patrón "ref con el último valor"
    // (stateRef, sincronizarRef, programarAutosaveRef) para que los timers y
    // los listeners lean el estado actual sin re-suscribirse: eso es leer y
    // escribir refs durante el render, a propósito.
    files: ['src/features/turno/useTurnoForm.ts'],
    rules: { 'react-hooks/refs': 'off', 'react-hooks/immutability': 'off' },
  },
  {
    // Las rutas de TanStack Router se cortan lanzando `redirect()` (su API)
    // y el archivo exporta objetos de ruta, no componentes.
    files: ['src/router.tsx'],
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
)
