# Red Huella

## Authentication

La API usa sesiones opacas revocables persistidas en PostgreSQL. El navegador recibe únicamente una cookie `HttpOnly`; no se guarda autenticación en `localStorage` ni `sessionStorage`. Registro, login, logout y usuario actual están disponibles bajo `/api/v1/auth`.

## Publications backend

La aplicación permite crear, consultar, listar y editar publicaciones `LOST`, `FOUND` y `ADOPTION`, cambiar su estado y gestionar hasta seis imágenes normalizadas por publicación. Ownership, estados, paginación y filtros se aplican en servidor.

## Frontend funcional

La web incluye rutas públicas de exploración, detalle, login y registro, además de creación, edición y publicaciones propias protegidas por estado de sesión. Los owners pueden configurar WhatsApp, teléfono o email por publicación; en el detalle `ACTIVE`, usuarios autenticados pueden revelarlos únicamente mediante click explícito. Configura `VITE_API_URL` desde `apps/web/.env.example`; es una URL pública, nunca un secreto. La sesión procede de `/auth/me` y la cookie HttpOnly no se lee ni almacena desde JavaScript.

## Descripción general

Red Huella es un Trabajo de Fin de Máster en desarrollo. Propone una plataforma web geolocalizada para ayudar a particulares y protectoras a publicar y localizar animales perdidos, encontrados o en adopción. El objetivo es reducir la dispersión de avisos, facilitar búsquedas relevantes y construir un proyecto Full Stack mantenible, seguro y verificable que también pueda servir como portfolio profesional.

El público previsto incluye personas responsables de animales, ciudadanía que encuentre un animal, adoptantes, protectoras y, en fases posteriores, personal de moderación.

## Estado del proyecto

**En desarrollo — Milestone 11 en curso (búsqueda visual).**

La aplicación implementa autenticación, publicaciones e imágenes, ubicación privada/pública separada, búsqueda por cercanía, mapas aproximados, mapa global, contacto autenticado y búsqueda visual por una foto efímera. Esta última recupera candidatos por similitud mediante CLIP y pgvector; no identifica animales ni expresa una probabilidad. La API Express usa PostgreSQL 17 + PostGIS + pgvector, Drizzle, errores sanitizados, request IDs, logging estructurado y cierre gracioso.

## Stack tecnológico

| Área            | Estado           | Tecnología                                                            |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| Frontend        | Funcional        | React 19, Vite, TypeScript, Leaflet y React-Leaflet                   |
| Backend         | Base técnica     | Node.js, Express, TypeScript, Helmet, CORS y Zod                      |
| Base de datos   | Geoespacial      | PostgreSQL 17, PostGIS 3.6, `pg`, Drizzle, migrations y seed          |
| Matching visual | En validación    | CLIP ViT-B/32, ONNX Runtime Node, pgvector y búsqueda coseno exacta   |
| Testing         | Base configurada | Vitest, React Testing Library y Supertest; Playwright queda pendiente |
| Infraestructura | CI inicial       | GitHub Actions; plataforma de despliegue pendiente                    |

## Requisitos

- Node.js 24 LTS (`>=24 <25`; véase `.nvmrc`).
- npm 11 (`>=11 <12`).
- PostgreSQL 17 con la extensión PostGIS disponible y activa.

## Arquitectura

Se mantendrá un monorepo con aplicaciones separadas y código compartido explícito. El frontend seguirá `UI → hooks/application → services → REST API`; el backend seguirá `Route → Controller → Service/Use Case → Repository → Database`. Los detalles y diagramas están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Funcionalidades previstas

### MVP

Registro, login, perfil, publicaciones de animales perdidos, encontrados y en adopción, imágenes, búsqueda, filtros, ubicación, mapa y contacto por publicación.

### Futuras

Favoritos, protectoras, reportes, roles, moderación y matching tradicional entre publicaciones `LOST` y `FOUND`.

### Avanzadas

Matching visual mediante embeddings, pgvector, PWA y mejoras de producto basadas en evidencia.

## Instalación

Desde la raíz del repositorio:

```bash
npm install
```

Este comando instala todos los workspaces y actualiza el único `package-lock.json` raíz.

## Ejecución frontend

```bash
npm run dev:web
```

Vite mostrará la URL local, habitualmente `http://localhost:5173`. La interfaz consume la API configurada mediante `VITE_API_URL`, incluidas las rutas relativas de contenido de imagen.

## Ejecución backend

```bash
npm run dev:api
```

La API usa por defecto `http://localhost:3000`. También se pueden iniciar ambos procesos con `npm run dev`; `concurrently` coordina y cierra ambos procesos de forma multiplataforma.

Antes de iniciar la API, copia `.env.example` a `.env` y adapta las URLs a tu instalación. `DATABASE_TEST_URL` es opcional para la API, pero obligatoria para `test:db`.

Para búsqueda visual descarga el artefacto fijado según [docs/VISUAL_SEARCH_SPIKE.md](docs/VISUAL_SEARCH_SPIKE.md), verifica su SHA-256 y configura `VISUAL_MODEL_PATH`. El modelo vive en `.data/models`, está ignorado por Git y nunca forma parte del bundle frontend.

## Health endpoint

`GET http://localhost:3000/api/v1/health` devuelve `200` con `{ "status": "ok", "database": "ok" }` cuando PostgreSQL responde, o `503` con `{ "status": "error", "database": "unavailable" }`. No expone configuración del sistema.

## PostgreSQL

La aplicación solo depende de `DATABASE_URL`; no detecta ni requiere Docker.

### Opción A — PostgreSQL local

Se requiere PostgreSQL 17 con PostGIS. La migración geoespacial `0003` está implementada y aplicada en el entorno validado. El procedimiento Windows específico y el preflight de solo lectura están en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Crea bases separadas de desarrollo y test con usuarios sin privilegios de superusuario. Ejemplo orientativo ejecutado por una cuenta administradora:

```sql
CREATE ROLE red_huella_app LOGIN PASSWORD 'contraseña-local-segura';
CREATE DATABASE red_huella OWNER red_huella_app;
CREATE ROLE red_huella_test LOGIN PASSWORD 'otra-contraseña-local';
CREATE DATABASE red_huella_test OWNER red_huella_test;
```

Configura ambas URLs en `.env`. La base de test debe ser distinta y su nombre debe terminar en `_test`.

### Opción B — Docker Compose

Si Docker está instalado:

```bash
docker compose up -d
```

`compose.yml` levanta `postgis/postgis:17-3.5` exclusivamente en `127.0.0.1:5434` (el contenedor conserva `5432`), con volumen persistente, healthcheck y credenciales exclusivamente de desarrollo. El cambio de imagen no reinicializa un volumen existente ni debe provocar su borrado. Docker Compose es un entorno local reproducible opcional; no representa la estrategia definitiva de producción. La aplicación sigue conociendo únicamente `DATABASE_URL`.

Diagnóstico de solo lectura contra la URL configurada:

```bash
npm run db:postgis:preflight
```

## Migrations y seed

Los comandos disponibles son:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed
```

El flujo principal usa migrations versionadas, nunca `db push`. `db:seed` añade de forma idempotente dos usuarios sin contraseña, tres animales y tres publicaciones. No crea administradores, credenciales, imágenes ficticias ni binarios demo.

## Tests PostgreSQL

```bash
npm run test:db
```

El comando requiere `NODE_ENV=test`, `DATABASE_TEST_URL` diferente de `DATABASE_URL` y una base cuyo nombre termine en `_test`. Aplica migrations y limpia exclusivamente las tablas conocidas de esa base de test entre pruebas.

## Tests E2E

Playwright valida seis recorridos críticos en Chromium contra API, frontend y PostgreSQL reales. Configura `DATABASE_E2E_URL` con una base exclusiva terminada en `_e2e`; la suite aplica migraciones y limpia solo ese entorno:

```bash
npm run test:e2e
npm run test:e2e:headed
```

La instalación inicial del navegador se realiza con `npx playwright install chromium`. Se requieren PostgreSQL 17, PostGIS y pgvector. Los servidores de prueba usan los puertos aislados 3100/5174 y los tiles externos quedan bloqueados. Consulta [docs/TESTING.md](docs/TESTING.md) para las salvaguardas, artefactos y alcance del mock HTTP de búsqueda visual.

## Estructura del proyecto

```text
red-huella/
├── apps/
│   ├── web/              # Frontend inicializado
│   └── api/              # Backend base y tooling PostgreSQL/Drizzle
├── packages/             # Reservado; sin paquete compartido prematuro
├── database/             # Migraciones y seeds futuros
├── docs/                 # Documentación viva
├── scripts/              # Automatización futura
├── .github/workflows/    # CI futura
├── AGENTS.md
├── SECURITY.md
└── package.json          # Coordinador de npm workspaces
```

## Testing

Existen tests de comportamiento frontend para autenticación, publicaciones, imágenes, geolocalización y contacto, además de suites unitarias, HTTP y PostgreSQL de la API. La estrategia completa está en [docs/TESTING.md](docs/TESTING.md).

## Calidad

Desde la raíz:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

## Seguridad

La estrategia, amenazas y separación entre controles implementados y planificados se documentan en [SECURITY.md](SECURITY.md).

## Deployment

Pendiente.

## Usuario demo

Pendiente.

## Slides

Pendiente para fase final del TFM.

## Vídeo

Pendiente para fase final del TFM.
