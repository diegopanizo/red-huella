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

El Bloque 1 incorporó pgvector 0.8.5, `vector(512)`, lifecycle versionado por imagen/checksum y repository interno. En ese punto, generación, backfill, worker, API de búsqueda, ranking y frontend permanecían pendientes.

El Bloque 2 incorpora checksum canónico, pipeline interno, PENDING no bloqueante para uploads y backfill manual idempotente/secuencial. API de búsqueda, ranking y frontend siguen pendientes.

El Bloque 3 incorporó procesamiento automático opt-in mediante polling no solapado, lotes secuenciales, lifecycle de startup/shutdown, claim cooperativo con advisory locks y CLI de un solo ciclo. Mantuvo el upload desacoplado; en ese punto, API de búsqueda, ranking y frontend permanecían pendientes.

El Bloque 4 incorporó el endpoint backend autenticado de búsqueda por imagen, multipart efímero, rate limiting, ranking coseno exacto y un resultado reducido por publicación. En ese punto, frontend, filtros geográficos, evaluación de calidad e índices ANN permanecían pendientes.

El Bloque 5 incorporó la ruta frontend autenticada `/search-by-image`, selección y preview efímeros, filtros simples, cancelación de solicitudes y cards centradas en la imagen coincidente. La búsqueda geográfica combinada, la evaluación con un dataset representativo y los índices ANN quedaron fuera de su alcance.

El Bloque 6 validó API autenticada, multipart, ONNX real, pgvector, lifecycle PENDING→READY, filtros, concurrencia básica y consumo de memoria. El conjunto de calibración no permitía Recall@K ni justificaba un threshold duro; la validación manual posterior completó el recorrido de navegador.

La validación manual posterior confirmó el recorrido real de navegador y un gato distinto con score `0,885872`. La calibración final de nueve casos mostró solapamiento incompatible con un threshold de identidad, consolidó el copy «Similitud visual» y mantuvo top-K. Con tests, integración, smoke y auditoría aprobados, Milestone 11 queda **COMPLETE**; evaluación de calidad con dataset representativo y cualquier ANN son mejoras futuras basadas en evidencia.

> Cambio de orden aprobado al iniciar el Milestone 11: este número estaba reservado a Favoritos y la búsqueda visual figuraba más adelante. El spike se adelanta para resolver pronto la viabilidad técnica; Favoritos y los objetivos intermedios se desplazan sin afirmar que estén implementados.

## Reorientación de la fase final

El roadmap original seguía una evolución incremental de producto. Una vez completado el núcleo funcional demostrable del TFM, las capacidades no esenciales pasan a trabajo futuro y la secuencia obligatoria se concentra en calidad, validación, despliegue reproducible y preparación de la entrega académica.

## Milestone 12 — Calidad final y hardening

- Revisar deuda técnica crítica, permisos, autorización, validaciones y manejo de errores.
- Revisar logging, configuración y dependencias con criterios prácticos de seguridad.
- Actualizar el threat model y contrastar los controles con OWASP.
- Corregir únicamente problemas críticos o de alto riesgo respaldados por evidencia.

Este milestone absorbe el alcance esencial de la antigua auditoría de seguridad. No incluye el desarrollo de Favoritos.

## Milestone 13 — Testing E2E y validación funcional

Incorporar Playwright o una solución E2E equivalente para recorridos críticos, aislados y reproducibles. La prioridad es:

1. registro y login;
2. creación de publicaciones;
3. gestión de imágenes;
4. mapa y «Cerca de mí»;
5. contacto entre usuarios;
6. búsqueda visual.

El objetivo es validar los recorridos demostrables del TFM, no exigir una cobertura E2E exhaustiva.

## Milestone 14 — Deployment y operación

- Preparar un entorno de producción realista para el TFM.
- Definir variables de entorno, base de datos, migraciones, almacenamiento y modelo visual.
- Configurar HTTPS, health/readiness, logs y backups básicos.
- Documentar el procedimiento de arranque y un runbook operativo.

No exige alta disponibilidad ni infraestructura empresarial.

## Milestone 15 — Preparación final TFM

- Completar el README definitivo: descripción, arquitectura, tecnologías, instalación, configuración, ejecución y tests.
- Preparar capturas, URL pública y credenciales demo cuando correspondan.
- Crear slides y vídeo/demo.
- Consolidar checklist final, limitaciones conocidas y trabajo futuro.

## Trabajo futuro

Estas líneas no forman parte del criterio obligatorio de finalización del TFM.

### Favoritos

Persistencia, API y UI de favoritos con autorización.

### Roles y moderación

Protectoras, reportes, roles y operaciones administrativas auditables.

### Matching tradicional

Servicio independiente y score explicable por especie, raza, color, tamaño, sexo, distancia y fecha, acompañado de evaluación y tests.

### Búsqueda visual futura

- Construir un dataset representativo.
- Evaluar Recall@K y calibrar la calidad con evidencia.
- Estudiar índices ANN si el volumen lo justifica.
- Mejorar o sustituir los embeddings según resultados medibles.

### Otras mejoras

- Recuperación de cuenta y verificación de email.
- Geocoding opcional con revisión previa de privacidad y proveedor.
- Almacenamiento de imágenes compatible con S3/R2 y cifrado gestionado de PII cuando el entorno de producción lo requiera.
- Rate limiting distribuido para despliegues con varias instancias.
- PWA y mejoras de producto basadas en evidencia.

## Criterio de finalización del TFM

El TFM se considera finalizado cuando:

- M0–M15 están completos;
- CI está verde y los tests críticos pasan;
- la aplicación puede ejecutarse y desplegarse de forma reproducible;
- la documentación está actualizada;
- la demo es reproducible;
- las limitaciones conocidas están documentadas explícitamente.

La implementación de los elementos de Trabajo futuro no es necesaria para cerrar el TFM.
