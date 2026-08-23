# ADR-026 — Deployment Docker Compose de referencia

**Estado:** Accepted  
**Fecha:** 2026-08-23

## Contexto

El TFM necesita un despliegue reproducible y defendible sin introducir Kubernetes, alta disponibilidad ni dependencias de un proveedor cloud. El runtime combina Node 24 con módulos nativos, PostgreSQL 17 con PostGIS/pgvector, assets Vite, imágenes privadas persistentes y un modelo ONNX no versionado.

## Decisión

Usar `compose.prod.yml` con tres servicios permanentes y una tarea one-shot:

- PostgreSQL 17 basado en pgvector 0.8.5 e instalación empaquetada de PostGIS.
- `migrate`, target separado con Drizzle Kit, ejecutado una vez antes de API.
- API Node 24 sobre Debian slim, dependencias runtime, usuario no root y filesystem read-only.
- Nginx unprivileged para assets React, fallback SPA y reverse proxy `/api` bajo un único origen.

PostgreSQL y API no publican puertos. Nginx publica HTTP solo en loopback y HTTPS termina fuera del Compose. LocalImageStorage usa un volumen persistente para una única réplica. El modelo ONNX se provisiona previamente, se valida mediante SHA-256 y se monta read-only; nunca se descarga al arrancar.

La identidad migradora posee el schema y una cuenta separada `red_huella_app` recibe privilegios runtime mediante default privileges. Las migraciones siguen creando extensiones y schema; producción nunca ejecuta seed.

## Alternativas descartadas

- Servir React desde Express: mezcla responsabilidades y obliga a reconstruir/reiniciar API para assets.
- Exponer frontend y API en orígenes distintos: añade complejidad de CORS/cookies sin aportar valor al TFM.
- Migrar al arrancar cada API: introduce carreras al escalar y mezcla startup con cambios de schema.
- Alpine: aumenta riesgo de incompatibilidad con Sharp, Argon2 y ONNX Runtime.
- Descargar el modelo en entrypoint: añade red, procedencia mutable y fallos silenciosos al startup.
- Kubernetes, S3/R2, Redis, CDN y observabilidad empresarial: exceden requisitos y escala actuales.

## Consecuencias

El despliegue es pequeño, reproducible y permite backup coordinado de DB/volumen. Requiere terminación TLS externa, provisioning del modelo y operación explícita de secretos/migraciones. LocalImageStorage limita el sistema a una réplica; los rate limits en memoria no son distribuidos. `trust proxy` permanece desactivado hasta conocer la topología exacta, por lo que los buckets IP pueden compartirse detrás de Nginx.
