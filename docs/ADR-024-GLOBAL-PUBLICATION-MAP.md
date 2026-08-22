# ADR-024 — Contrato backend del mapa global

## Estado

Aceptada e implementada parcialmente. Milestone 10, Bloque 1; el frontend permanece pendiente.

## Contexto

El mapa global necesita consultar el viewport visible sin descargar el listado completo, contar todas las filas ni exponer el aggregate público general. La ubicación exacta es privada y no puede intervenir ni siquiera como fallback. Un viewport puede cruzar el antimeridiano y una respuesta sin tope facilitaría abuso y degradación del navegador/API.

## Decisión

- Exponer `GET /api/v1/publications/map`, público y sin sesión, con bounds obligatorios `north`, `south`, `west`, `east` en Web Mercator y filtros opcionales allowlist `type`, `species`, `status`.
- Usar exclusivamente `public_location`. Un viewport normal usa un envelope; al cruzar el antimeridiano se divide en dos ramas inclusivas e indexables. Cada rama combina el operador bounding-box de GiST con `ST_Covers` para la comprobación exacta.
- Mantener `public_location` como `geography(Point,4326)` e interpretar el envelope como geometría 4326 para `ST_Covers`; el cast del punto a geometry no cambia ni revela sus coordenadas.
- Crear un repository específico con SELECT allowlist y join único al thumbnail principal (`position = 0`). No reutilizar `findMany`, el DTO completo, count ni consultas N+1.
- Ordenar por `created_at DESC, id DESC`, leer como máximo 501 filas y devolver 500 con `truncated`; el cliente no controla el límite.
- Permitir `ACTIVE` por defecto y filtros explícitos `RESOLVED`/`ADOPTED`; rechazar `ARCHIVED`.
- Aplicar 60 peticiones por minuto e IP mediante store en memoria, con `429 MAP_RATE_LIMITED`.
- Responder con revalidación pública (`public, no-cache, max-age=0, must-revalidate`) y el ETag normal de Express.

## Contrato minimizado

Cada elemento contiene únicamente id, tipo, estado, título, fecha del evento, centro/radio públicos, nombre/especie/raza y URL/dimensiones del thumbnail o `null`. No contiene descripción, autor, IDs internos del animal/usuario, sexo, contacto, ubicación exacta/legacy, keys de storage ni metadata PostGIS.

## Consecuencias

La consulta puede servirse con el GiST existente y no requiere migración. El tope reduce scraping y carga, pero el rate limiter no coordina instancias; producción multiinstancia necesitará un store compartido. Clustering, viewport frontend, tiles de producción y virtualización se decidirán en bloques posteriores.
