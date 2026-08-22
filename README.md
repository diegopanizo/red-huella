# Red Huella

## Descripción general

Red Huella es un Trabajo de Fin de Máster en desarrollo. Propone una plataforma web geolocalizada para ayudar a particulares y protectoras a publicar y localizar animales perdidos, encontrados o en adopción. El objetivo es reducir la dispersión de avisos, facilitar búsquedas relevantes y construir un proyecto Full Stack mantenible, seguro y verificable que también pueda servir como portfolio profesional.

El público previsto incluye personas responsables de animales, ciudadanía que encuentre un animal, adoptantes, protectoras y, en fases posteriores, personal de moderación.

## Estado del proyecto

**En desarrollo — Milestone 2 completado (backend base y diseño de persistencia).**

Actualmente existe una plantilla frontend React/Vite ejecutable y una API Express con health de PostgreSQL, errores sanitizados, request IDs, logging estructurado y cierre gracioso. Drizzle y el pool PostgreSQL están configurados, pero no existe todavía ningún schema de negocio ni se ha verificado una instancia local en este entorno.

## Stack tecnológico

| Área            | Estado            | Tecnología                                                            |
| --------------- | ----------------- | --------------------------------------------------------------------- |
| Frontend        | Inicializado      | React, Vite, TypeScript, ESLint                                       |
| Backend         | Base técnica      | Node.js, Express, TypeScript, Helmet, CORS y Zod                      |
| Base de datos   | Tooling preparado | PostgreSQL, `pg` y Drizzle; schema de negocio pendiente               |
| Matching visual | Futuro            | pgvector y proveedor desacoplado de embeddings                        |
| Testing         | Base configurada  | Vitest, React Testing Library y Supertest; Playwright queda pendiente |
| Infraestructura | CI inicial        | GitHub Actions; plataforma de despliegue pendiente                    |

## Requisitos

- Node.js 24 LTS (`>=24 <25`; véase `.nvmrc`).
- npm 11 (`>=11 <12`).

## Arquitectura

Se mantendrá un monorepo con aplicaciones separadas y código compartido explícito. El frontend seguirá `UI → hooks/application → services → REST API`; el backend seguirá `Route → Controller → Service/Use Case → Repository → Database`. Los detalles y diagramas están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Funcionalidades previstas

### MVP

Registro, login, perfil, publicaciones de animales perdidos, encontrados y en adopción, imágenes, búsqueda, filtros, ubicación, mapa y favoritos.

### Futuras

Protectoras, reportes, roles, moderación y matching tradicional entre publicaciones `LOST` y `FOUND`.

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

Vite mostrará la URL local, habitualmente `http://localhost:5173`. La interfaz actual es la plantilla inicial, no el producto Red Huella.

## Ejecución backend

```bash
npm run dev:api
```

La API usa por defecto `http://localhost:3000`. También se pueden iniciar ambos procesos con `npm run dev`; `concurrently` coordina y cierra ambos procesos de forma multiplataforma.

Antes de iniciar la API, copia `.env.example` a `.env` y sustituye `CHANGE_ME` por una contraseña local. Todas las variables son obligatorias y se validan al arrancar.

## Health endpoint

`GET http://localhost:3000/api/v1/health` devuelve `200` con `{ "status": "ok", "database": "ok" }` cuando PostgreSQL responde, o `503` con `{ "status": "error", "database": "unavailable" }`. No expone configuración del sistema.

## PostgreSQL local y Drizzle

Instala PostgreSQL localmente, crea una base `red_huella` y un usuario de aplicación sin privilegios de superusuario. Ejemplo orientativo ejecutado por una cuenta administradora:

```sql
CREATE ROLE red_huella_app LOGIN PASSWORD 'contraseña-local-segura';
CREATE DATABASE red_huella OWNER red_huella_app;
```

Después configura `DATABASE_URL` en `.env`. El repositorio no incluye Docker en esta fase. Los comandos disponibles son:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

No hay migraciones ni tablas todavía porque crear una tabla técnica artificial no aporta valor.

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

Existen un test de renderizado real del frontend y un test de integración del health endpoint. La estrategia completa está en [docs/TESTING.md](docs/TESTING.md).

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
