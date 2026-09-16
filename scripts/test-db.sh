#!/usr/bin/env bash
# Prueba las migraciones de la Fase 1 sobre datos "sucios" y corre los
# tests pgTAP, en la base local de Supabase (Docker).
#
#   pnpm exec supabase start      # una vez
#   ./scripts/test-db.sh
#
# Ciclo: reset hasta la Fase 0 → seed_test.sql → migraciones 20260916*
# → supabase/tests/*.test.sql. Todo local; no toca ningún proyecto remoto.
set -euo pipefail
cd "$(dirname "$0")/.."

SUPABASE=node_modules/.bin/supabase
DB=supabase_db_planillas-fryt
FASE0=20260915000200

echo "▸ reset local hasta $FASE0"
$SUPABASE db reset --local --version "$FASE0" 2>&1 | grep -iv "^NOTICE\|seed.sql" | tail -2

echo "▸ seed de prueba"
docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/seed_test.sql \
  2>&1 | grep -v "invocar_edge_function" | grep -E "ERROR|FATAL" && exit 1 || true

echo "▸ migraciones pendientes"
$SUPABASE migration up --local 2>&1 | grep -iE "error|applied" | tail -3

fallos=0
for f in supabase/tests/*.test.sql; do
  echo "▸ $f"
  salida=$(docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -qtA < "$f" 2>&1 | grep -v "invocar_edge_function\|no privileges were granted")
  echo "$salida" | grep -E "^(not ok|# |ERROR|psql:)" || true
  ok=$(echo "$salida" | grep -c "^ok " || true)
  notok=$(echo "$salida" | grep -c "^not ok " || true)
  echo "  ok=$ok  not ok=$notok"
  fallos=$((fallos + notok))
  echo "$salida" | grep -qE "^(ERROR|psql:)" && fallos=$((fallos + 1)) || true
done

[ "$fallos" -eq 0 ] && echo "✔ todo en verde" || { echo "✘ $fallos fallo(s)"; exit 1; }
