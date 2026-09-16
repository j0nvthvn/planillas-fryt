#!/usr/bin/env bash
# Vuelca una base de Supabase a una carpeta: respaldo.dump (pg_dump -Fc de
# public, auth y storage), manifiesto.json (filas y sumas) y logos/ (el
# bucket público de logos). Lo usa .github/workflows/respaldo.yml; sirve
# igual a mano. Solo lee.
#
#   SUPABASE_DB_URL=postgresql://postgres.<ref>:<clave>@<pooler>:5432/postgres \
#   SUPABASE_URL=https://<ref>.supabase.co \
#   ./scripts/respaldo/volcar.sh <carpeta>
#
# pg_dump/psql corren en la imagen postgres:17 (misma versión que el
# servidor). Sin SUPABASE_URL no se descargan los logos.
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${SUPABASE_DB_URL:?falta SUPABASE_DB_URL}"
out=${1:?uso: volcar.sh <carpeta>}
mkdir -p "$out"
out=$(cd "$out" && pwd)

pg() { docker run --rm -i --network host --user "$(id -u):$(id -g)" -e PGURL="$SUPABASE_DB_URL" -v "$out:/out" postgres:17 "$@"; }

echo "▸ pg_dump"
pg sh -c 'pg_dump "$PGURL" -Fc --schema=public --schema=auth --schema=storage -f /out/respaldo.dump'

echo "▸ manifiesto"
pg sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 -qtA' < scripts/respaldo/manifiesto.sql > "$out/manifiesto.json"
cat "$out/manifiesto.json"

if [ -n "${SUPABASE_URL:-}" ]; then
  echo "▸ logos"
  mkdir -p "$out/logos"
  n=0
  while IFS= read -r nombre; do
    [ -z "$nombre" ] && continue
    curl -fsS --retry 3 -o "$out/logos/$nombre" \
      "$SUPABASE_URL/storage/v1/object/public/logos-proveedores/$(printf %s "$nombre" | jq -sRr @uri)"
    n=$((n + 1))
  done < <(pg sh -c 'psql "$PGURL" -qtA -c "select name from storage.objects where bucket_id = '\''logos-proveedores'\'' and name not like '\''%/%'\''"')
  echo "  $n logos"
fi

ls -la "$out"
