# Changelog

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

### Changed

- Unificadas las versiones de TypeScript y las dependencias compartidas del toolchain.
- Eliminada la aserción no segura al obtener el elemento raíz de React.

### Fixed

- Ninguno.

### Security

- Documentado el modelo inicial de amenazas y la estrategia de protección de ubicaciones sensibles.
