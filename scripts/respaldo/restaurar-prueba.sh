#!/usr/bin/env bash
# Simulacro de restauración: carga un respaldo (carpeta de volcar.sh, ya
# descifrada) en la base LOCAL de Supabase (Docker) y comprueba que los
# conteos y sumas coinciden con su manifiesto y que verificar_integridad()
# no reporta errores. Borra todo lo que haya en la base local.
#
#   pnpm exec supabase start -x studio,imgproxy,inbucket,mailpit,logflare,vector,edge-runtime,realtime,storage-api,supavisor,pg_prove
#   ./scripts/respaldo/restaurar-prueba.sh <carpeta>
#
# Esquema: el de las migraciones del repo (así también se comprueba que
# el repo reproduce prod). Datos: public completo + auth.users/identities.
# Para una restauración real en otro proyecto, ver docs/operacion.md.
set -euo pipefail
cd "$(dirname "$0")/../.."

dir=${1:?uso: restaurar-prueba.sh <carpeta con respaldo.dump y manifiesto.json>}
[ -f "$dir/respaldo.dump" ] && [ -f "$dir/manifiesto.json" ] || { echo "faltan archivos en $dir"; exit 2; }

SUPABASE=node_modules/.bin/supabase
DB=supabase_db_planillas-fryt
admin() { docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

echo "▸ base local con las migraciones del repo"
$SUPABASE db reset --local 2>&1 | grep -iE "error|finished" | tail -2

echo "▸ vaciar tablas (las migraciones siembran algunas)"
admin -c "
  set client_min_messages = warning;
  truncate auth.users cascade;
  do \$\$ declare r record; begin
    for r in select tablename from pg_tables where schemaname = 'public' loop
      execute format('truncate public.%I cascade', r.tablename);
    end loop;
  end \$\$;"

echo "▸ pg_restore"
docker cp "$dir/respaldo.dump" "$DB:/tmp/respaldo.dump"
# --disable-triggers: sin auditoría ni updated_at nuevos, y las FKs (la de
# turno_cierres a sí misma) no dependen del orden de las filas.
docker exec "$DB" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers --no-owner \
  --schema=public /tmp/respaldo.dump
docker exec "$DB" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers --no-owner \
  --schema=auth --table=users --table=identities /tmp/respaldo.dump
docker exec "$DB" rm -f /tmp/respaldo.dump

echo "▸ comparar con el manifiesto"
admin < scripts/respaldo/manifiesto.sql > "$dir/manifiesto.restaurado.json"
if ! diff <(jq -S . "$dir/manifiesto.json") <(jq -S . "$dir/manifiesto.restaurado.json"); then
  echo "✘ la restauración no coincide con el manifiesto"
  exit 1
fi
echo "  $(jq -c .filas "$dir/manifiesto.json")"

echo "▸ verificar_integridad()"
hallazgos=$(admin -F ' | ' -c "select * from public.verificar_integridad()")
echo "${hallazgos:-  sin hallazgos}"
if grep -q '^error' <<< "$hallazgos"; then
  echo "✘ el respaldo tiene errores de integridad"
  exit 1
fi

echo "✔ respaldo restaurable y consistente"
