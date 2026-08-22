# Red Huella

## Descripción general

Red Huella es un Trabajo de Fin de Máster en desarrollo. Propone una plataforma web geolocalizada para ayudar a particulares y protectoras a publicar y localizar animales perdidos, encontrados o en adopción. El objetivo es reducir la dispersión de avisos, facilitar búsquedas relevantes y construir un proyecto Full Stack mantenible, seguro y verificable que también pueda servir como portfolio profesional.

El público previsto incluye personas responsables de animales, ciudadanía que encuentre un animal, adoptantes, protectoras y, en fases posteriores, personal de moderación.

## Estado del proyecto

**En desarrollo — Milestone 1 completado (monorepo y tooling base).**

Actualmente existe una plantilla frontend React/Vite ejecutable y una API Express mínima con un endpoint técnico de salud. El repositorio usa npm workspaces y dispone de lint, formato, typecheck, tests y build coordinados. No hay autenticación, persistencia, mapas, uploads, matching ni despliegue.

## Stack tecnológico

| Área            | Estado           | Tecnología                                                            |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| Frontend        | Inicializado     | React, Vite, TypeScript, ESLint                                       |
| Backend         | Base técnica     | Node.js, Express, TypeScript, Helmet, CORS y Zod                      |
| Base de datos   | Planificada      | PostgreSQL; PostGIS en la fase geoespacial                            |
| Matching visual | Futuro           | pgvector y proveedor desacoplado de embeddings                        |
| Testing         | Base configurada | Vitest, React Testing Library y Supertest; Playwright queda pendiente |
| Infraestructura | CI inicial       | GitHub Actions; plataforma de despliegue pendiente                    |

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

Las variables disponibles están documentadas en `.env.example`. Los valores predeterminados son seguros para desarrollo local.

## Health endpoint

`GET http://localhost:3000/api/v1/health` devuelve `200` y `{ "status": "ok" }`. Es un endpoint técnico y no expone configuración del sistema.

## Estructura del proyecto

```text
red-huella/
├── apps/
│   ├── web/              # Frontend inicializado
│   └── api/              # Configuración inicial; implementación pendiente
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
