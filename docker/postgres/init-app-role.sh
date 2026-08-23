#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_DATABASE_PASSWORD:?APP_DATABASE_PASSWORD is required}"

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DATABASE_PASSWORD" \
  --set=database_name="$POSTGRES_DB" \
  --set=migration_role="$POSTGRES_USER" <<'SQL'
SELECT format('CREATE ROLE red_huella_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'red_huella_app')
\gexec

GRANT CONNECT ON DATABASE :"database_name" TO red_huella_app;
GRANT USAGE ON SCHEMA public TO red_huella_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_role" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO red_huella_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_role" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO red_huella_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_role" IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO red_huella_app;
SQL
