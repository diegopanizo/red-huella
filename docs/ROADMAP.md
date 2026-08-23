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

## Milestone 7 — Imágenes (completado)

Implementado el ciclo completo de imágenes por publicación: almacenamiento desacoplado con adaptador local, normalización segura JPEG/PNG/WebP mediante Sharp, variantes WebP display/thumbnail sin metadatos ni originales, upload multipart acotado, ownership y reglas por estado, máximo de seis imágenes, reordenación, imagen principal, eliminación y outbox de borrado con compensación ante fallos. El frontend incorpora selección y previews, reintento del upload posterior a la creación, galería, placeholders y gestión owner responsive. Las capas unitarias, HTTP, PostgreSQL y frontend cubren límites, formatos, seguridad, concurrencia, consistencia y cleanup.

## Milestone 8 — Geolocalización (completado)

Implementados PostgreSQL 17 + PostGIS, modelo exacto/público, política de privacidad por tipo, migración/backfill, endpoint owner, búsqueda por radio y distancia, selector Leaflet, mapa público aproximado y búsqueda voluntaria «Buscar cerca de mí». No se incluyeron mapa global, geocoding, clustering ni tracking.

> Cambio de orden aprobado al iniciar el Milestone 7: el roadmap anterior situaba geolocalización en el Milestone 7 e imágenes en el 8. Se adelantó imágenes para completar las publicaciones antes de incorporar capacidades geoespaciales; el cambio se registra en ADR-021 y no implica que el antiguo Milestone 7 se haya implementado.

## Milestone 9 — Contacto entre usuarios (completado)

Contacto voluntario por publicación mediante WhatsApp, teléfono y email, aislado de los DTO públicos. Completados decisión/persistencia, backend owner, consulta protegida con rate limiting, configuración owner y revelación explícita desde el detalle autenticado, con retorno seguro desde login y limpieza de PII en cliente.

> Cambio de orden aprobado al iniciar el Milestone 9: este número estaba reservado anteriormente a Favoritos. Contacto se prioriza para completar el ciclo de una publicación; Favoritos y los milestones futuros se desplazan una posición sin afirmar que hayan sido implementados.

## Milestone 10 — Mapa global de publicaciones (completado)

Completado el mapa global con contrato público por viewport basado exclusivamente en `public_location`, filtros, privacidad espacial, antimeridiano, límite, rate limiting y consulta GiST. Explorar integra mapa Leaflet y mini lista sincronizados, thumbnails, popups, clustering, selección, viewport pending/applied, «Buscar en esta zona», cancelación de respuestas obsoletas y conservación ante errores. Cerca de mí centra el mapa según su radio sin persistir ni representar la ubicación del navegador. En móvil, un selector accesible Lista/Mapa mantiene ambos paneles y sus resultados montados, conserva selección y evita scroll y refetch innecesarios; desktop mantiene la vista simultánea. Tests unitarios, frontend y PostgreSQL cubren contrato, privacidad e interacción.

El refinamiento visual transversal iniciado en 2026 define tokens, jerarquía de acciones y una presentación editorial responsive para header, hero, filtros, cards y mapa. Es una mejora de UX sobre funcionalidades existentes y no cierra el milestone ni incorpora clustering o búsqueda visual.

> Cambio de orden aprobado al iniciar el Milestone 10: este número estaba reservado anteriormente a Favoritos. El mapa global se prioriza como continuación de la base PostGIS; Favoritos y los milestones posteriores se desplazan sin afirmar que hayan sido implementados.

## Milestone 11 — Búsqueda visual (completado)

El Bloque 0.1 valida de forma aislada embeddings CLIP ViT-B/32 de 512 dimensiones con Sharp y ONNX Runtime Node en CPU. El resultado provisional es Node/ONNX viable con reservas: no hay todavía PostgreSQL, pgvector, API, frontend ni arquitectura final, y la eficacia debe evaluarse con un dataset representativo antes de diseñar producto.

El Bloque 1 incorpora pgvector 0.8.5, `vector(512)`, lifecycle versionado por imagen/checksum y repository interno. Generación, backfill, worker, API de búsqueda, ranking y frontend permanecen pendientes; Milestone 11 continúa **IN PROGRESS**.

El Bloque 2 incorpora checksum canónico, pipeline interno, PENDING no bloqueante para uploads y backfill manual idempotente/secuencial. API de búsqueda, ranking y frontend siguen pendientes.

El Bloque 3 incorpora procesamiento automático opt-in mediante polling no solapado, lotes secuenciales, lifecycle de startup/shutdown, claim cooperativo con advisory locks y CLI de un solo ciclo. Mantiene el upload desacoplado y no incorpora API de búsqueda, ranking ni frontend; Milestone 11 continúa **IN PROGRESS**.

El Bloque 4 incorpora el endpoint backend autenticado de búsqueda por imagen, multipart efímero, rate limiting, ranking coseno exacto y un resultado reducido por publicación. El frontend, filtros geográficos, evaluación de calidad e índices ANN permanecen pendientes; Milestone 11 continúa **IN PROGRESS**.

El Bloque 5 incorpora la ruta frontend autenticada `/search-by-image`, selección y preview efímeros, filtros simples, cancelación de solicitudes y cards centradas en la imagen coincidente. La búsqueda geográfica combinada, evaluación de calidad e índices ANN permanecen pendientes; Milestone 11 continúa **IN PROGRESS**.

El Bloque 6 valida API autenticada, multipart, ONNX real, pgvector, lifecycle PENDING→READY, filtros, concurrencia básica y consumo de memoria. El smoke visual completo en navegador no pudo ejecutarse en el entorno del agente y el conjunto de calibración no permite Recall@K; por ello el milestone permanece **IN PROGRESS** y sin threshold duro.

La validación manual posterior confirmó el recorrido real de navegador y un gato distinto con score `0,885872`. La calibración final de nueve casos mostró solapamiento incompatible con un threshold de identidad, consolidó el copy «Similitud visual» y mantuvo top-K. Con tests, integración, smoke y auditoría aprobados, Milestone 11 queda **COMPLETE**; evaluación de calidad con dataset representativo y cualquier ANN son mejoras futuras basadas en evidencia.

> Cambio de orden aprobado al iniciar el Milestone 11: este número estaba reservado a Favoritos y la búsqueda visual figuraba más adelante. El spike se adelanta para resolver pronto la viabilidad técnica; Favoritos y los objetivos intermedios se desplazan sin afirmar que estén implementados.

## Milestone 12 — Favoritos

Persistencia, API y UI de favoritos con autorización.

## Milestone 13 — Roles y moderación

Protectoras, reportes, roles y operaciones administrativas auditables.

## Milestone 14 — Matching tradicional

Servicio independiente, score explicable con especie, raza, color, tamaño, sexo, distancia y fecha, más evaluación y tests.

## Milestone 15 — Testing E2E

Playwright, datos aislados y recorridos críticos automatizados.

## Milestone 16 — Auditoría de seguridad

Threat model actualizado, revisión OWASP, dependencias, permisos, configuración y pruebas de abuso.

## Milestone 17 — Deployment

Infraestructura, dominio, HTTPS, migraciones, backups, observabilidad y runbook.

## Milestone 18 — Preparación final TFM

- README definitivo y capturas.
- Slides y URL pública.
- Vídeo con captura durante la explicación y URL pública.
- Credenciales demo y URLs de producción.
- Checklist y documentación final de entrega.
