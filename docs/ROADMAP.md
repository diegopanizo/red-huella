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

## Milestone 5 — Publicaciones (completado)

Modelo y API para animales/publicaciones, estados, propiedad, validación y tests.

## Milestone 6 — Frontend funcional (completado)

Navegación, identidad y flujos de publicaciones accesibles y responsive conectados a la API.

## Milestone 7 — Imágenes (en curso)

Upload seguro, procesamiento, eliminación de EXIF, almacenamiento desacoplado y ciclo de borrado. Los Bloques 1–4 implementan schema/storage, Sharp, backend HTTP y experiencia frontend respectivamente. El milestone continúa en curso hasta su cierre final; no se adelantan geolocalización ni funcionalidades posteriores.

## Milestone 8 — Geolocalización (completado)

Implementados PostgreSQL 17 + PostGIS, modelo exacto/público, política de privacidad por tipo, migración/backfill, endpoint owner, búsqueda por radio y distancia, selector Leaflet, mapa público aproximado y búsqueda voluntaria «Buscar cerca de mí». No se incluyeron mapa global, geocoding, clustering ni tracking.

> Cambio de orden aprobado al iniciar el Milestone 7: el roadmap anterior situaba geolocalización en el Milestone 7 e imágenes en el 8. Se adelantó imágenes para completar las publicaciones antes de incorporar capacidades geoespaciales; el cambio se registra en ADR-021 y no implica que el antiguo Milestone 7 se haya implementado.

## Milestone 9 — Contacto entre usuarios (completado)

Contacto voluntario por publicación mediante WhatsApp, teléfono y email, aislado de los DTO públicos. Completados decisión/persistencia, backend owner, consulta protegida con rate limiting, configuración owner y revelación explícita desde el detalle autenticado, con retorno seguro desde login y limpieza de PII en cliente.

> Cambio de orden aprobado al iniciar el Milestone 9: este número estaba reservado anteriormente a Favoritos. Contacto se prioriza para completar el ciclo de una publicación; Favoritos y los milestones futuros se desplazan una posición sin afirmar que hayan sido implementados.

## Milestone 10 — Mapa global de publicaciones (en curso)

El Bloque 1 implementa el contrato público y backend de consulta por viewport, con privacidad espacial, antimeridiano, límite y rate limiting. El Bloque 2 añade en Explorar un mapa Leaflet básico con mini lista, marcadores aproximados, popup, filtros compartidos y carga diferida. El Bloque 3 implementa viewport pending/applied, «Buscar en esta zona», cancelación de respuestas obsoletas y conservación ante errores; su pulido 3.1 amplía y equilibra el layout responsive sin alterar ese comportamiento. Clustering, integración con Cerca de mí y experiencia móvil final permanecen pendientes.

El refinamiento visual transversal iniciado en 2026 define tokens, jerarquía de acciones y una presentación editorial responsive para header, hero, filtros, cards y mapa. Es una mejora de UX sobre funcionalidades existentes y no cierra el milestone ni incorpora clustering o búsqueda visual.

> Cambio de orden aprobado al iniciar el Milestone 10: este número estaba reservado anteriormente a Favoritos. El mapa global se prioriza como continuación de la base PostGIS; Favoritos y los milestones posteriores se desplazan sin afirmar que hayan sido implementados.

## Milestone 11 — Favoritos

Persistencia, API y UI de favoritos con autorización.

## Milestone 12 — Roles y moderación

Protectoras, reportes, roles y operaciones administrativas auditables.

## Milestone 13 — Matching tradicional

Servicio independiente, score explicable con especie, raza, color, tamaño, sexo, distancia y fecha, más evaluación y tests.

## Milestone 14 — Testing E2E

Playwright, datos aislados y recorridos críticos automatizados.

## Milestone 15 — Auditoría de seguridad

Threat model actualizado, revisión OWASP, dependencias, permisos, configuración y pruebas de abuso.

## Milestone 16 — Matching visual

Evaluación ética/técnica, proveedor de embeddings desacoplado, pgvector, métricas y comunicación de incertidumbre.

## Milestone 17 — Deployment

Infraestructura, dominio, HTTPS, migraciones, backups, observabilidad y runbook.

## Milestone 18 — Preparación final TFM

- README definitivo y capturas.
- Slides y URL pública.
- Vídeo con captura durante la explicación y URL pública.
- Credenciales demo y URLs de producción.
- Checklist y documentación final de entrega.
