# Deployment y runbook operativo

## Alcance y topología

El despliegue de referencia del TFM usa Docker Compose, una sola réplica de API y almacenamiento local persistente. No pretende ofrecer alta disponibilidad ni sustituir una plataforma gestionada.

```text
Browser ──HTTPS──> terminador TLS ──HTTP──> web (Nginx :8080)
                                            ├── /        assets React
                                            └── /api/* ──> api (:3000)
                                                               ├── postgres (:5432)
                                                               ├── volumen de imágenes
                                                               └── modelo ONNX read-only
```

Solo `web` publica un puerto, ligado por defecto a `127.0.0.1:8080`. PostgreSQL y API viven exclusivamente en la red interna de Compose. HTTPS debe terminar en un reverse proxy del host o en la plataforma; este repositorio no genera certificados ni publica HTTP directamente a Internet.

## Prerrequisitos

- Docker Engine con Docker Compose v2.
- Host Linux x64/arm64 con espacio para PostgreSQL, imágenes y el modelo de 89 MB.
- DNS y terminación TLS configurados fuera de este Compose.
- Backups iniciales si se actualiza un despliegue existente.
- El artefacto ONNX provisionado y verificado antes de habilitar el procesador visual.

Las imágenes usan Node 24 sobre Debian Bookworm, evitando Alpine por Sharp, Argon2 y ONNX Runtime. PostgreSQL se construye desde pgvector `0.8.5` para PostgreSQL 17 e instala PostGIS 3 desde paquetes Debian.

## Preparación de variables

Copiar la plantilla sin versionar el resultado:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Sustituir todos los placeholders. Las contraseñas incluidas en URLs PostgreSQL deben estar percent-encoded. `WEB_ORIGIN` debe ser el origen HTTPS público exacto, sin path ni barra final. El Compose se invoca siempre con:

```bash
docker compose --env-file .env.production -f compose.prod.yml COMMAND
```

Compose usa el archivo solo para interpolación y mantiene allowlists de entorno por servicio: la API no recibe `POSTGRES_PASSWORD`, `APP_DATABASE_PASSWORD` ni `MIGRATION_DATABASE_URL`.

Variables relevantes:

| Variable                             | Uso                                                            |
| ------------------------------------ | -------------------------------------------------------------- |
| `NODE_ENV=production`                | Activa cookies Secure y validaciones productivas.              |
| `PORT=3000`                          | Puerto interno de Express.                                     |
| `WEB_ORIGIN`                         | Origen HTTPS exacto permitido por CORS/Origin.                 |
| `DATABASE_URL`                       | Cuenta runtime `red_huella_app`, sin privilegios de migración. |
| `MIGRATION_DATABASE_URL`             | Cuenta propietaria usada solo por el job one-shot.             |
| `LOG_LEVEL`                          | Nivel Pino; `info` es el valor inicial recomendado.            |
| `IMAGE_STORAGE_DRIVER=local`         | Driver implementado para una réplica.                          |
| `IMAGE_STORAGE_LOCAL_ROOT`           | `/app/.data/uploads` sobre volumen persistente.                |
| `VISUAL_MODEL_PATH`                  | Ruta interna del modelo montado read-only.                     |
| `VISUAL_EMBEDDING_PROCESSOR_ENABLED` | Habilita el polling de embeddings.                             |
| `VISUAL_EMBEDDING_POLL_INTERVAL_MS`  | Intervalo, entre 5 s y 1 h.                                    |
| `VISUAL_EMBEDDING_BATCH_SIZE`        | Lote secuencial, entre 1 y 50.                                 |
| `WEB_HTTP_PORT`                      | Puerto loopback del host para el terminador TLS.               |

`VISUAL_MODEL_ID` y `VISUAL_MODEL_VERSION` son metadata documental y no son consumidas por el runtime actual.

## Modelo visual

El modelo no se copia a imágenes ni se descarga durante startup. Provisionarlo en el host:

```bash
mkdir -p .data/models
curl --fail --location \
  'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d/onnx/vision_model_quantized.onnx?download=true' \
  --output .data/models/clip-vit-base-patch32-vision-quantized.onnx
echo '583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299  .data/models/clip-vit-base-patch32-vision-quantized.onnx' | sha256sum --check
```

Procedencia, licencia pendiente de revisión productiva y comandos PowerShell están en `docs/VISUAL_SEARCH_SPIKE.md`. Si `VISUAL_MODEL_PATH` se omite, el processor no arranca; si se configura una ruta ausente o inválida, detecta `MODEL_LOAD_FAILED` en su primer lote y deja de programar ciclos. La API y el resto del producto continúan disponibles, mientras la búsqueda visual responde con el error estable de indisponibilidad. Para un despliegue que prometa búsqueda visual, la verificación del archivo es un preflight obligatorio.

## Build, migraciones y arranque

Validar primero la interpolación, sin mostrar el resultado en sistemas donde pueda exponer secretos:

```bash
docker compose --env-file .env.production -f compose.prod.yml config --quiet
```

Construir y arrancar:

```bash
docker compose --env-file .env.production -f compose.prod.yml build --pull
docker compose --env-file .env.production -f compose.prod.yml up -d
```

Orden efectivo:

1. PostgreSQL alcanza `pg_isready`.
2. `migrate` ejecuta una vez `npm run db:migrate` con la identidad propietaria.
3. API arranca solo si `migrate` termina con código cero.
4. Nginx arranca cuando `/api/v1/health` confirma base disponible.

Las migraciones `0000`–`0005` siguen siendo la única autoridad del schema y ejecutan `CREATE EXTENSION postgis` y `CREATE EXTENSION vector`. No se ejecuta seed. El job separado evita migraciones concurrentes si en el futuro cambia el número de réplicas.

En la primera inicialización, `10-app-role.sh` crea `red_huella_app` y configura privilegios por defecto sobre objetos creados por la identidad migradora. Los scripts de init no vuelven a ejecutarse sobre un volumen existente. Rotar credenciales o adoptar esta topología sobre una base previa exige una operación SQL administrada, no borrar el volumen.

## Verificación

```bash
docker compose --env-file .env.production -f compose.prod.yml ps
curl --fail http://127.0.0.1:${WEB_HTTP_PORT:-8080}/
curl --fail http://127.0.0.1:${WEB_HTTP_PORT:-8080}/api/v1/health
docker compose --env-file .env.production -f compose.prod.yml logs migrate
```

El health existente es readiness: comprueba API y PostgreSQL y devuelve 503 si la base no responde. No existe un liveness separado; usar este endpoint como liveness podría reiniciar la API durante una caída transitoria de PostgreSQL. Compose lo emplea para ordenar el startup, no para implementar orquestación empresarial.

Después de disponer de HTTPS, realizar un smoke manual: registro/login, creación de publicación, upload y lectura de imagen, mapa, contacto bajo demanda y búsqueda visual si el modelo está verificado. Las cookies `Secure` no permiten validar auth productiva mediante el HTTP loopback sin TLS.

## HTTPS y reverse proxy

El terminador externo debe reenviar al puerto loopback de Nginx y preservar host/esquema. `WEB_ORIGIN` debe coincidir con el origen visto por el navegador. Nginx sirve la SPA con fallback a `index.html`, deshabilita directory listing por defecto, cachea solo assets Vite con hash y reenvía `/api/` sin alterar los headers de caché privados de imágenes/contacto.

La API no habilita `trust proxy` porque la topología final puede variar. Por ello los rate limits por IP ven la dirección del proxy en este Compose y pueden compartir bucket entre usuarios. Antes de exposición pública se debe fijar el número exacto de proxies confiables y validar spoofing de `X-Forwarded-For`; no se debe activar `trust proxy=true` genéricamente.

## Logs y diagnóstico

- API escribe logs JSON en stdout/stderr, con request ID y redacción de campos sensibles.
- Nginx y PostgreSQL escriben en sus streams estándar.
- El health no expone versiones, rutas ni secretos.

```bash
docker compose --env-file .env.production -f compose.prod.yml logs --tail=200 api
docker compose --env-file .env.production -f compose.prod.yml logs --tail=200 web
docker compose --env-file .env.production -f compose.prod.yml logs --tail=200 postgres
docker compose --env-file .env.production -f compose.prod.yml logs --follow
```

No registrar `.env.production`, dumps, imágenes, modelo, cookies, tokens ni datos de contacto.

## Backup

Coordinar backup de DB e imágenes en la misma ventana y registrar sus timestamps:

```bash
mkdir -p backups
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  sh -c 'pg_dump --format=custom --no-owner --username "$POSTGRES_USER" "$POSTGRES_DB"' \
  > backups/red_huella.dump
docker run --rm \
  --volume red-huella-production_red_huella_image_data:/source:ro \
  --volume "$PWD/backups:/backup" \
  debian:bookworm-slim tar -C /source -czf /backup/red_huella_images.tar.gz .
```

Los backups contienen PII de contacto y ubicaciones exactas: cifrarlos, limitar acceso, definir retención y probar restauraciones. En plataformas con nombres de proyecto distintos, obtener el nombre real del volumen mediante `docker volume ls` en vez de asumirlo.

El modelo no requiere backup si puede reprovisionarse desde la revisión fijada y verificarse con SHA-256. Sí deben preservarse de forma segura `.env.production`, configuración TLS y la referencia de versión desplegada.

## Restore

1. Detener `web` y `api` para impedir escrituras.
2. Restaurar PostgreSQL en una base vacía compatible con PostgreSQL 17/PostGIS/pgvector.
3. Restaurar el volumen de imágenes.
4. Reprovisionar y verificar el modelo.
5. Aplicar migraciones de la versión que se va a arrancar.
6. Arrancar y verificar health y recorridos críticos.

Ejemplo orientativo para DB vacía:

```bash
docker compose --env-file .env.production -f compose.prod.yml stop web api
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  sh -c 'pg_restore --clean --if-exists --no-owner --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' \
  < backups/red_huella.dump
```

No restaurar un dump sobre producción activa. Verificar propietarios y grants de `red_huella_app` después de un restore procedente de otra topología.

## Actualización, rollback y parada

Actualización:

```bash
git fetch --tags
git checkout REPLACE_WITH_REVIEWED_REVISION
docker compose --env-file .env.production -f compose.prod.yml build --pull
docker compose --env-file .env.production -f compose.prod.yml up -d
```

Revisar previamente las migraciones y hacer backup. El rollback simple consiste en volver a la imagen/revisión anterior solo si su código es compatible con el schema ya migrado. Las migraciones destructivas requieren un plan específico; no se revierte la DB automáticamente.

Parada conservando datos:

```bash
docker compose --env-file .env.production -f compose.prod.yml down
```

Nunca usar `down --volumes` en operación normal: elimina los volúmenes persistentes.

## Troubleshooting

- **`migrate` falla:** revisar sus logs, conectividad y disponibilidad de extensiones; no arrancar API saltándose el job.
- **Health 503:** comprobar `postgres`, credenciales y migraciones. El endpoint representa readiness.
- **Búsqueda visual 503:** verificar existencia, permisos y SHA-256 del modelo, además de `VISUAL_EMBEDDING_PROCESSOR_ENABLED`.
- **Uploads fallan:** verificar espacio, inodos y permisos del volumen `red_huella_image_data`; revisar también su directorio `tmp`.
- **Login falla tras publicar:** confirmar HTTPS real y coincidencia exacta de `WEB_ORIGIN`; la cookie es Secure en producción.
- **429 inesperados detrás del proxy:** revisar la limitación documentada de `trust proxy` antes de modificarla.
- **Init no crea el rol:** los scripts solo se ejecutan con un volumen PostgreSQL nuevo; corregir roles de forma administrada sin borrar datos.

## PostgreSQL 17 local en Windows

El entorno de desarrollo Windows sigue siendo independiente: PostgreSQL 17 usa el puerto 5433 y PostgreSQL 9.5 legado en 5432 no debe tocarse. `npm run db:postgis:preflight` es diagnóstico de solo lectura. El Compose de producción no modifica instalaciones ni volúmenes locales.
