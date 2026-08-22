# Changelog

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
