# Red Huella

Red Huella es una aplicación web para publicar y localizar animales perdidos, encontrados o en adopción. Centraliza avisos dispersos, permite explorarlos por criterios y zona aproximada y ofrece contacto protegido entre usuarios.

Es un Trabajo de Fin de Máster con el núcleo funcional completo. Los milestones M0–M15 están cerrados, la integración continua valida código, PostgreSQL y recorridos críticos, y el deployment de referencia se construye y arranca de forma reproducible. Las limitaciones operativas y de producto están documentadas explícitamente.

## Funcionalidades principales

- Registro, login y logout mediante sesiones opacas revocables en cookie HttpOnly.
- Publicaciones `LOST`, `FOUND` y `ADOPTION`, ownership, estados y filtros.
- Hasta seis imágenes por publicación, normalizadas a WebP y sin metadatos.
- Separación entre ubicación exacta privada y zona pública aproximada.
- Búsqueda por cercanía y mapa global con clustering, lista sincronizada y experiencia móvil.
- Contacto por WhatsApp, teléfono o email, configurado por publicación y revelado bajo demanda a usuarios autenticados.
- Búsqueda por similitud visual con CLIP, ONNX Runtime y pgvector.
- Interfaz responsive y accesible para explorar, crear y gestionar publicaciones.

La búsqueda visual propone imágenes parecidas: no identifica animales ni expresa una probabilidad de identidad.

## Cómo funciona

Una persona se registra y crea una publicación de un animal perdido, encontrado o en adopción. Puede añadir imágenes, indicar una ubicación y decidir qué métodos de contacto desea ofrecer. El servidor mantiene separada la ubicación exacta privada de la zona aproximada mostrada públicamente.

Otros usuarios pueden explorar publicaciones mediante filtros, cercanía o mapa global, consultar el detalle y, tras autenticarse, revelar bajo demanda los métodos de contacto habilitados. También pueden enviar una fotografía efímera para obtener publicaciones visualmente similares, sin que el sistema interprete el resultado como identificación del animal.

## Arquitectura

El monorepo usa npm workspaces y separa frontend y backend:

```text
Browser → React/Vite → REST /api/v1 → Express → servicios → repositories → PostgreSQL
                                                ↘ Sharp / ONNX
```

- Frontend: `UI → hooks/application → services → API`.
- Backend: `Route → Controller → Service/Use Case → Repository → Database`.
- PostgreSQL 17 es la fuente de verdad; PostGIS soporta consultas espaciales y pgvector la similitud visual.
- Las imágenes viven fuera de PostgreSQL mediante una abstracción de almacenamiento.
- En producción, Nginx sirve la SPA y actúa como reverse proxy bajo un único origen.

El diseño completo está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y las decisiones en [docs/DECISIONS.md](docs/DECISIONS.md).

## Componentes del sistema

- **Aplicación web:** presenta los flujos públicos y privados, coordina el estado remoto y consume la API con cookies de sesión.
- **API REST:** valida entradas, autentica sesiones, aplica ownership y coordina publicaciones, imágenes, ubicaciones, contacto y búsqueda visual.
- **PostgreSQL:** conserva usuarios, sesiones, publicaciones, metadatos de imágenes, métodos de contacto y embeddings mediante migraciones versionadas.
- **PostGIS:** separa las ubicaciones exactas y públicas y ejecuta las consultas espaciales exclusivamente sobre `public_location` en funcionalidades públicas.
- **Procesamiento de imágenes:** Sharp valida y normaliza los uploads a variantes WebP sin conservar originales ni metadatos.
- **Búsqueda visual:** ONNX Runtime genera embeddings CLIP y pgvector ordena candidatos por similitud coseno.
- **Almacenamiento:** una interfaz separa los metadatos PostgreSQL de los archivos físicos; la implementación actual usa almacenamiento local persistente.
- **Entrega web:** Nginx sirve el bundle frontend y reenvía `/api` a Express bajo un único origen.
- **Automatización:** GitHub Actions valida calidad, integración PostgreSQL, E2E y contenedores de producción.

## Stack tecnológico

| Área            | Tecnología                                                                           |
| --------------- | ------------------------------------------------------------------------------------ |
| Frontend        | React 19, Vite, TypeScript, TanStack Query, React Hook Form, Leaflet y React-Leaflet |
| Backend         | Node.js 24, Express, TypeScript, Zod, Helmet, Pino y Sharp                           |
| Datos           | PostgreSQL 17, PostGIS, pgvector 0.8.5, Drizzle ORM y `pg`                           |
| Búsqueda visual | CLIP ViT-B/32 y ONNX Runtime Node                                                    |
| Testing         | Vitest, React Testing Library, Supertest y Playwright                                |
| Operación       | GitHub Actions, Docker Compose y Nginx unprivileged                                  |

## Requisitos

- Node.js 24 LTS (`>=24 <25`; véase `.nvmrc`).
- npm 11 (`>=11 <12`).
- PostgreSQL 17 con PostGIS y pgvector para las funciones y suites con base real.
- Docker Compose, opcional en desarrollo y necesario para reproducir el deployment.
- Chromium de Playwright para E2E.
- Modelo ONNX provisionado externamente para inferencia visual real.

## Instalación y configuración

```bash
npm install
cp .env.example .env
```

Adapta las URLs PostgreSQL de `.env`. Deben existir bases separadas para desarrollo, tests y E2E; las dos últimas deben terminar en `_test` y `_e2e`. No reutilices credenciales de ejemplo fuera de desarrollo.

El backend usa `DATABASE_URL`; `DATABASE_TEST_URL` es obligatoria para `test:db` y `DATABASE_E2E_URL` para Playwright. El frontend toma `VITE_API_URL` de `apps/web/.env.example`.

Para búsqueda visual, descarga y verifica el artefacto fijado siguiendo [docs/VISUAL_SEARCH_SPIKE.md](docs/VISUAL_SEARCH_SPIKE.md), guárdalo en `.data/models` y configura `VISUAL_MODEL_PATH`. El modelo, uploads y temporales están ignorados por Git.

## Inicio rápido

Este recorrido utiliza PostgreSQL proporcionado por Docker y ejecuta frontend y API como procesos locales:

1. Instala Node.js 24, npm 11 y Docker Compose.
2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Crea el archivo local de entorno:

   ```bash
   cp .env.example .env
   ```

   En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. En `.env`, selecciona las URLs comentadas para Docker que utilizan el puerto `5434`.
5. Arranca PostgreSQL y comprueba su estado:

   ```bash
   docker compose up -d
   docker compose ps
   ```

6. Aplica las migraciones:

   ```bash
   npm run db:migrate
   ```

7. Inicia API y frontend:

   ```bash
   npm run dev
   ```

8. Abre `http://localhost:5173`. La API puede comprobarse en `http://localhost:3000/api/v1/health`.

El `compose.yml` de desarrollo levanta PostgreSQL, no la API ni el frontend. El modelo ONNX tampoco es obligatorio para iniciar o utilizar el resto de la aplicación: si no se provisiona, únicamente la búsqueda visual permanece indisponible.

### PostgreSQL local o Docker

La instalación local debe proporcionar PostgreSQL 17, PostGIS y pgvector. El procedimiento y preflight están en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Como alternativa de desarrollo:

```bash
docker compose up -d
```

`compose.yml` publica PostgreSQL solamente en `127.0.0.1:5434` y conserva datos en un volumen. Cambiar la imagen no inicializa extensiones sobre un volumen existente ni autoriza a borrarlo.

## Desarrollo y ejecución local

```bash
npm run db:migrate
npm run dev
```

También pueden iniciarse por separado:

```bash
npm run dev:api
npm run dev:web
```

La API escucha normalmente en `http://localhost:3000` y Vite en `http://localhost:5173`. `GET /api/v1/health` devuelve `200` cuando API y PostgreSQL están disponibles.

El seed es opcional e idempotente:

```bash
npm run db:seed
```

Crea datos de demostración sin contraseñas, imágenes binarias ni credenciales utilizables. Para una prueba local debe registrarse un usuario desde la interfaz o mediante `POST /api/v1/auth/register`. Las credenciales indicadas al final del README pertenecen exclusivamente al entorno de demostración desplegado y no son creadas por el seed.

## Estructura del proyecto

```text
red-huella/
├── apps/
│   ├── api/                  # API Express, servicios, repositories y Drizzle
│   └── web/                  # Aplicación React/Vite y funcionalidades de interfaz
├── database/
│   └── migrations/           # Migraciones SQL versionadas
├── docker/
│   ├── ci-postgres/          # PostgreSQL con extensiones para CI
│   ├── nginx/                # Reverse proxy y servidor del frontend
│   └── postgres/             # Imagen PostgreSQL de producción
├── docs/                     # Arquitectura, API, ADR, seguridad y operación
├── tests/e2e/                # Recorridos Playwright y bootstrap aislado
├── .github/workflows/        # Integración continua
├── compose.yml               # PostgreSQL para desarrollo
├── compose.prod.yml          # Stack de producción reproducible
├── .env.example              # Configuración local sin secretos
├── .env.production.example   # Plantilla operativa sin secretos reales
└── package.json              # Scripts y coordinación de npm workspaces
```

Frontend y backend son workspaces independientes coordinados desde la raíz. Las migraciones son la única autoridad del esquema. Los archivos generados, uploads, temporales y el modelo ONNX viven en `.data` y no se versionan.

## Tests y calidad

```bash
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run test:e2e
npm run build
npm run format:check
npm audit --omit=dev
```

- `npm run test`: 265 tests unitarios y de integración sin PostgreSQL real.
- `npm run test:db`: 99 tests contra PostgreSQL/PostGIS/pgvector en una base `_test` protegida.
- `npm run test:e2e`: 6 recorridos Playwright en Chromium contra API, frontend y base `_e2e` reales.

Playwright usa puertos aislados 3100/5174, bloquea tiles externos y no reutiliza servidores. La búsqueda visual E2E intercepta solo su petición de inferencia porque el modelo no se versiona; el pipeline ONNX real se valida en suites específicas. Consulta [docs/TESTING.md](docs/TESTING.md).

## Búsqueda visual

La consulta recibe una imagen efímera, la valida y normaliza con Sharp, genera un embedding CLIP de 512 dimensiones y ordena candidatos `READY` compatibles por distancia coseno exacta en pgvector. La imagen de consulta, embedding y score no se persisten ni aparecen en logs. El endpoint exige autenticación, Origin válido y rate limiting.

El modelo se provisiona fuera del repositorio con checksum verificado. Sin modelo válido, el resto de la aplicación continúa disponible y la búsqueda devuelve un error estable de indisponibilidad.

## Deployment

El deployment de referencia usa `compose.prod.yml`: PostgreSQL 17 con PostGIS y pgvector, migración one-shot, API Node no root, almacenamiento persistente de imágenes y Nginx unprivileged como único punto HTTP.

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f compose.prod.yml config --quiet
docker compose --env-file .env.production -f compose.prod.yml build --pull
docker compose --env-file .env.production -f compose.prod.yml up -d
```

GitHub Actions valida configuración, construye imágenes, arranca el stack y comprueba PostgreSQL, migraciones, API y ambos endpoints HTTP a través de Nginx. HTTPS termina fuera de Compose; antes de aceptar usuarios reales deben configurarse secretos, dominio, TLS, backups y retención. Véase [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Limitaciones conocidas

- La similitud visual no demuestra identidad y se ha calibrado con un conjunto pequeño, no con un dataset representativo.
- Los rate limiters viven en memoria y no coordinan múltiples instancias.
- Los datos de contacto se almacenan en texto plano; producción requiere permisos mínimos y backups cifrados, y puede justificar envelope encryption/KMS.
- El modelo ONNX se provisiona externamente y no forma parte de las imágenes Docker.
- El almacenamiento de imágenes es local persistente; un adaptador S3/R2 queda como evolución futura.
- `trust proxy` permanece deshabilitado hasta fijar y probar la topología real de proxies.
- Verificación de email y recuperación de cuenta no están implementadas.
- Favoritos, moderación, roles de protectoras y matching tradicional quedan fuera del alcance entregado.

## Trabajo futuro

El trabajo futuro se priorizará con evidencia: dataset representativo y Recall@K, ANN si el volumen lo justifica, S3/R2, rate limiting distribuido, protección gestionada de PII, recuperación/verificación de cuenta, favoritos, reportes, moderación y matching explicable `LOST`–`FOUND`.

## Documentación

- [Roadmap](docs/ROADMAP.md)
- [API](docs/API.md)
- [Testing](docs/TESTING.md)
- [Privacidad](docs/PRIVACY.md)
- [Seguridad](SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Checklist de entrega](docs/DELIVERY-CHECKLIST.md)

## Acceso de demostración y documentación

- slide presentacion: `https://docs.google.com/presentation/d/1UnoUEN47D84QB0bbLWvQGo6GCegUCTE1/edit?usp=sharing&ouid=102368770880966002232&rtpof=true&sd=true`

- sitio web montado: `https://51-255-39-243.sslip.io/`

Credenciales destinadas exclusivamente al entorno de demostración:

- Usuario: `prueba@test.com`
- Contraseña: `pruebatest123`
