#!/usr/bin/env bash
# Copia prod a otro proyecto Supabase (Fase 4: us-east-2 → sa-east-1).
# Sirve para el ensayo y para el cambio definitivo: cada corrida BORRA los
# datos del destino y los reemplaza por los del origen.
#
#   set -a; . ~/.config/frytcontrol/migracion.env; set +a
#   CONFIRMAR_DESTINO=<ref destino> ./scripts/migrar-region.sh <carpeta>
#
# Variables (en migracion.env, nunca en el repo):
#   ORIGEN_DB_URL, DESTINO_DB_URL  cadenas del session pooler (puerto 5432)
#   ORIGEN_REF, DESTINO_REF        refs de los proyectos
#   SILENCIAR_CORREOS=1            deja notificaciones_activas=false en el
#                                  destino (ensayos: que no le lleguen
#                                  correos a la dueña desde la copia)
#
# Pasos: volcar el origen (scripts/respaldo/volcar.sh) → migraciones del
# repo en el destino → vaciar y cargar public + auth.users/identities →
# logos → comparar el manifiesto y verificar_integridad(). Si algo no
# coincide, termina con error.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ORIGEN_DB_URL:?}" "${DESTINO_DB_URL:?}" "${ORIGEN_REF:?}" "${DESTINO_REF:?}"
dir=${1:?uso: migrar-region.sh <carpeta fuera del repo>}
[ "$DESTINO_REF" != kfmwhtbvgqurnpotypii ] || { echo "el destino no puede ser prod"; exit 2; }
[ "${CONFIRMAR_DESTINO:-}" = "$DESTINO_REF" ] || { echo "falta CONFIRMAR_DESTINO=$DESTINO_REF (esta corrida borra sus datos)"; exit 2; }
grep -q "$DESTINO_REF" <<< "$DESTINO_DB_URL" || { echo "DESTINO_DB_URL no es de $DESTINO_REF"; exit 2; }

SUPABASE=node_modules/.bin/supabase
ORIGEN_URL="https://$ORIGEN_REF.supabase.co"
DESTINO_URL="https://$DESTINO_REF.supabase.co"
mkdir -p "$dir"
dir=$(cd "$dir" && pwd)
destino() { docker run --rm -i --network host -e PGURL="$DESTINO_DB_URL" -v "$dir:/out" postgres:17 sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 -qtA "$@"' sh "$@"; }

echo "▸ volcar el origen"
SUPABASE_DB_URL="$ORIGEN_DB_URL" SUPABASE_URL="$ORIGEN_URL" ./scripts/respaldo/volcar.sh "$dir" >/dev/null
jq -c .filas "$dir/manifiesto.json"

echo "▸ migraciones del repo en el destino"
$SUPABASE db push --db-url "$DESTINO_DB_URL" --include-all --yes 2>&1 | grep -viE "^NOTICE|skipping" | tail -3

echo "▸ vaciar el destino"
destino -c "
  set client_min_messages = warning;
  delete from auth.users;
  do \$\$ declare r record; begin
    for r in select tablename from pg_tables where schemaname = 'public' loop
      execute format('truncate public.%I cascade', r.tablename);
    end loop;
  end \$\$;"

echo "▸ cargar datos"
# session_replication_role = replica: sin triggers (auditoría, updated_at,
# correo de cierre) ni chequeo de FKs durante la carga, en una transacción.
docker run --rm -i --network host -e PGURL="$DESTINO_DB_URL" -v "$dir:/out" postgres:17 sh -c '
  { echo "set session_replication_role = replica;"
    pg_restore --data-only --no-owner --no-privileges --schema=public -f - /out/respaldo.dump
    pg_restore --data-only --no-owner --no-privileges --schema=auth --table=users --table=identities -f - /out/respaldo.dump
  } | psql "$PGURL" -v ON_ERROR_STOP=1 -q --single-transaction' 2>&1 | grep -v "^SET$" || true

echo "▸ logos"
service_key=$($SUPABASE projects api-keys --project-ref "$DESTINO_REF" -o json | jq -r '.[] | select(.name == "service_role") | .api_key')
SUPABASE_URL="$DESTINO_URL" SUPABASE_SERVICE_ROLE_KEY="$service_key" node scripts/copiar-logos.mjs "$dir/logos" | tail -1
destino -c "update public.proveedores_frecuentes set imagen_url = replace(imagen_url, '$ORIGEN_URL', '$DESTINO_URL') where imagen_url like '$ORIGEN_URL%'"

if [ "${SILENCIAR_CORREOS:-}" = 1 ]; then
  echo "▸ correos apagados en el destino"
  destino -c "update public.configuracion set valor = 'false' where clave = 'notificaciones_activas'"
fi

echo "▸ comparar con el manifiesto"
destino < scripts/respaldo/manifiesto.sql > "$dir/manifiesto.destino.json"
if ! diff <(jq -S . "$dir/manifiesto.json") <(jq -S . "$dir/manifiesto.destino.json"); then
  echo "✘ el destino no coincide con el origen"
  exit 1
fi

echo "▸ verificar_integridad()"
hallazgos=$(destino -F ' | ' -c "select * from public.verificar_integridad()")
echo "${hallazgos:-  sin hallazgos}"
if grep -q '^error' <<< "$hallazgos"; then
  echo "✘ errores de integridad en el destino"
  exit 1
fi

echo "✔ $DESTINO_REF tiene los mismos datos que $ORIGEN_REF"
