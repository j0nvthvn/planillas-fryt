#!/usr/bin/env bash
# Regenera las declaraciones que design-sync lee para extraer las props de
# cada componente: types/ (tsc) e index.d.ts (espejo de .design-sync/entry.tsx).
# Ambos están en .gitignore; correr desde la raíz del repo antes del conversor.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf types index.d.ts
node_modules/.bin/tsc -p tsconfig.app.json --emitDeclarationOnly --declaration \
  --noEmit false --rootDir src --outDir types
python3 - <<'PY'
import re
src = open('.design-sync/entry.tsx').read()
out = ["// Generado por .design-sync/tipos.sh: entrada de tipos que refleja",
       "// .design-sync/entry.tsx, para que el conversor lea las props reales.",
       "// No se versiona.", ""]
out += [re.sub(r"'@/", "'./types/", l).rstrip().rstrip(';') + ';'
        for l in src.splitlines() if l.startswith('export ')]
open('index.d.ts', 'w').write('\n'.join(out) + '\n')
PY
echo "types/ e index.d.ts regenerados"
