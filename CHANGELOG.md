# Changelog

## Milestone 9 — completado

- Añadido contacto voluntario por publicación mediante WhatsApp, teléfono y email, sin reutilizar automáticamente el email de acceso.
- Incorporada `publication_contact_methods` mediante la migración `0004`, con E.164, email normalizado, unicidad por publicación/método y FK cascade.
- Añadidos endpoints owner GET/PUT con ownership, Origin, locking transaccional, no-store y política de solo retirada en estados finales.
- Añadida revelación autenticada bajo demanda para publicaciones `ACTIVE`, con autor activo, 404 uniforme, rate limiting por usuario/IP y respuestas privadas sin ETag.
- Incorporada configuración frontend owner, reintentos independientes, retorno seguro desde login y enlaces validados para `wa.me`, `tel:` y `mailto:`.
- Añadida limpieza de PII al ocultar, desmontar, cambiar de publicación o cerrar sesión; contacto continúa ausente de DTOs públicos, cards, listados, búsquedas y logs.
- Documentadas las deudas de texto plano temporal, cifrado de backups/permisos mínimos, futura envelope encryption/KMS, rate limiter single-instance y advisories dev de `drizzle-kit`/`esbuild`; runtime sin vulnerabilidades conocidas en la auditoría de cierre.

## Milestone 8 — completado

- Incorporados PostgreSQL 17 + PostGIS, `geography(Point,4326)` e índice GiST sobre `public_location` mediante la migración `0003`.
- Separadas `exact_location` privada y `public_location` aproximada, aleatoria, persistida y versionada, con radios por tipo y DTOs públicos allowlist.
- Añadidos create/PATCH geográficos, endpoint owner `/manage`, búsqueda `ST_DWithin`, distancia pública redondeada y `order=distance`.
- Añadidos `LocationPicker`, fallback manual, geolocalización voluntaria, `PublicLocationMap` y búsqueda «Buscar cerca de mí» con radios configurables.
- Aplicados y verificados el backfill legacy idempotente y la limpieza de `latitude`/`longitude` migradas; las columnas se conservan temporalmente para retirada en una migración futura.

## Milestone 7 — en curso

- Añadidos almacenamiento local desacoplado, normalización WebP segura, metadata por variante y outbox específica de borrado.
- Implementados upload multipart, ownership, locking de capacidad, borrado/reordenación transaccional y entrega por stream con ETag.
- Añadidos selector y previews locales, fallo parcial recuperable, galería responsive, thumbnails en cards y gestión accesible de imágenes propias.
- El milestone permanece abierto hasta su bloque de cierre y verificación final.

## Milestone 6

- Sustituido el scaffold de Vite por una interfaz responsive con routing, autenticación, exploración, detalle y gestión de publicaciones.
- Añadidos cliente HTTP central, TanStack Query, formularios validados, estados de carga/error/vacío y tests de comportamiento frontend.

## Milestone 5

- API backend de publicaciones con creación atómica de animal/publicación, lectura pública, listado paginado y publicaciones propias.
- Edición transaccional, ownership backend, transiciones de estado, archivado lógico, DTO allowlist y protección Origin.
- Pruebas unitarias, HTTP y PostgreSQL para filtros, seguridad, estados y rollback.

## Milestone 4

- Añadidos registro, login, logout y `/me` con Argon2id y sesiones opacas PostgreSQL.
- Añadidas migración de `password_hash`/`sessions`, cookies seguras, Origin check, rate limiting y pruebas unitarias, HTTP y PostgreSQL.

Todos los cambios relevantes de Red Huella se documentarán aquí siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto aún no tiene una versión publicada.

## [Unreleased]

### Added

- Documentación inicial de arquitectura, requisitos, seguridad, privacidad, API, datos, testing, despliegue, roadmap y entrega del TFM.
- Guías iniciales de proyecto, contribución y trabajo para agentes.
- Monorepo con npm workspaces, lockfile único y comandos coordinados.
- Tooling común con ESLint, Prettier, TypeScript estricto y Vitest.
- API Express mínima con configuración validada y `GET /api/v1/health`.
- Tests reales de renderizado frontend e integración del health endpoint.
- Pipeline inicial de GitHub Actions y versión de Node reproducible.
- Coordinación multiplataforma de los servidores de desarrollo.
- Pool PostgreSQL y tooling Drizzle sin tablas artificiales.
- Health/readiness con estado de base de datos y respuesta 503 ante indisponibilidad.
- Errores globales sanitizados, request IDs, logging Pino y cierre gracioso.
- Tests unitarios de configuración, errores y health, más integración HTTP 200/503/404.
- Modelo PostgreSQL inicial para usuarios, animales, publicaciones e imágenes, con enums, constraints e índices.
- Migration Drizzle inicial, seed idempotente y repositories tipados para las tres entidades principales.
- PostgreSQL 17 opcional mediante Compose y job CI aislado para integración real.
- Salvaguardas para impedir limpieza de una base que no sea explícitamente de test.

### Changed

- Unificadas las versiones de TypeScript y las dependencias compartidas del toolchain.
- Eliminada la aserción no segura al obtener el elemento raíz de React.

### Fixed

- Ninguno.

### Security

- Documentado el modelo inicial de amenazas y la estrategia de protección de ubicaciones sensibles.
- Añadidos redacción de logs, configuración obligatoria validada, límite JSON y respuestas sin detalles internos.
