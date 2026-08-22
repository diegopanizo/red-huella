# Roadmap

El roadmap es secuencial a nivel de objetivos, pero podrá refinarse mediante ADR. Un milestone solo se completa con evidencia y documentación actualizada.

## Milestone 0 — Arquitectura y documentación (completado)

- Auditar el repositorio y reflejar su estado real.
- Definir arquitectura, requisitos, seguridad, privacidad, API conceptual, datos y calidad.
- Crear documentación de gobierno y entrega.
- Verificar que el frontend inicial conserva lint y build.

## Milestone 1 — Configuración del monorepo (completado)

- Elegir y configurar workspaces y comandos raíz.
- Unificar versiones compatibles de TypeScript/Node y declarar `strict: true` en todos los proyectos.
- Configurar lint, format, typecheck, test y build sin duplicar dependencias.
- Crear estructura mínima solo donde haya contenido real.

## Milestone 2 — Backend base y diseño de persistencia (completado)

Implementados tooling PostgreSQL/Drizzle, pool central, logging, errores, health/readiness, cierre gracioso, tests y documentación; no se añadieron entidades.

## Milestone 3 — Modelo de datos inicial y PostgreSQL (completado)

Implementados cuatro tablas, migration, seed, constraints, índices, repositories, Compose opcional y suite PostgreSQL separada. La ejecución local real queda pendiente de credenciales.

## Milestone 4 — Autenticación y gestión inicial de usuarios (completado)

Registro, sesión opaca persistente, Argon2id, autorización base y tests de abuso. Recuperación y verificación de email quedan planificadas.

## Milestone 5 — Publicaciones (siguiente)

Modelo y API para animales/publicaciones, estados, propiedad, validación y tests.

## Milestone 6 — Frontend funcional

Navegación, identidad y flujos de publicaciones accesibles y responsive conectados a la API.

## Milestone 7 — Geolocalización

PostGIS, búsquedas espaciales y separación verificada entre ubicación exacta y pública.

## Milestone 8 — Imágenes

Upload seguro, procesamiento, eliminación de EXIF, almacenamiento y ciclo de borrado.

## Milestone 9 — Favoritos

Persistencia, API y UI de favoritos con autorización.

## Milestone 10 — Roles y moderación

Protectoras, reportes, roles y operaciones administrativas auditables.

## Milestone 11 — Matching tradicional

Servicio independiente, score explicable con especie, raza, color, tamaño, sexo, distancia y fecha, más evaluación y tests.

## Milestone 12 — Testing E2E

Playwright, datos aislados y recorridos críticos automatizados.

## Milestone 13 — Auditoría de seguridad

Threat model actualizado, revisión OWASP, dependencias, permisos, configuración y pruebas de abuso.

## Milestone 14 — Matching visual

Evaluación ética/técnica, proveedor de embeddings desacoplado, pgvector, métricas y comunicación de incertidumbre.

## Milestone 15 — Deployment

Infraestructura, dominio, HTTPS, migraciones, backups, observabilidad y runbook.

## Milestone 16 — Preparación final TFM

- README definitivo y capturas.
- Slides y URL pública.
- Vídeo con captura durante la explicación y URL pública.
- Credenciales demo y URLs de producción.
- Checklist y documentación final de entrega.
