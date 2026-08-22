# ADR-022 — Estrategia geoespacial y privacidad de ubicación

**Estado:** Aceptado e implementado en Milestone 8; migración, backfill y aplicación local validados.

## Contexto

Las publicaciones conservaban provisionalmente `latitude` y `longitude`. Milestone 8 debía permitir selección visual y búsquedas por distancia sin convertir domicilios o lugares sensibles en datos públicos ni en un oráculo inferible mediante filtros.

## Decisión

PostgreSQL 17 usa la extensión `postgis` y cuatro columnas en `publications`:

- `exact_location geography(Point,4326)`;
- `public_location geography(Point,4326)`;
- `public_location_radius_meters integer`;
- `location_privacy_version smallint`.

Las consultas públicas geográficas usan exclusivamente `public_location`, con GiST y `ST_DWithin` en metros. `exact_location` no interviene en DTOs, filtros, distancias, ordenación ni mapas públicos.

Política aprobada:

| Tipo       | Ubicación interna                                                 | Zona pública  |
| ---------- | ----------------------------------------------------------------- | ------------- |
| `LOST`     | conserva `exact_location`                                         | radio 1.000 m |
| `FOUND`    | conserva `exact_location`                                         | radio 1.500 m |
| `ADOPTION` | `exact_location` permanece `NULL`; la entrada representa una zona | radio 5.000 m |

El servidor genera un centro público aleatorio, persistido y versionado. No se recalcula en cada lectura. Para `LOST` y `FOUND`, su desplazamiento respecto al punto exacto nunca supera el radio declarado, de forma que el punto exacto queda dentro de la zona mostrada. El cliente no puede fijar directamente el centro público.

La API pública nunca devuelve `exactLocation`. La lectura privada de gestión se implementa como `GET /api/v1/publications/:id/manage`, con autenticación, ownership y `private, no-store`. La búsqueda pública acepta radios entre 500 y 100.000 metros; el frontend usa 25.000 metros por defecto.

Leaflet y React-Leaflet implementan el selector owner y el mapa público separado. Los tiles de OpenStreetMap se usan solo en desarrollo/demo, con atribución; no se consideran infraestructura de producción.

## Migración

No se modificaron las migraciones `0000`, `0001` ni `0002`. `0003_unique_omega_flight.sql` incorpora `CREATE EXTENSION IF NOT EXISTS postgis`, columnas, constraints e índice GiST y fue aplicada manualmente en local/test. El backfill explícito, dry-run por defecto, fue aplicado y verificado como idempotente. Las columnas legacy permanecen por compatibilidad estructural, sin uso público, y podrán retirarse en una migración futura tras confirmar que ningún entorno necesita rollback o backfill. Nunca se copia una coordenada exacta directamente al campo público.

## Alternativas descartadas

- Mantener pares `double precision`: no aportan semántica espacial ni índice GiST.
- `geometry(Point,4326)` como almacenamiento principal: obliga a tratar grados o introducir casts/índices de expresión para distancias globales en metros.
- Publicar el punto exacto o usarlo silenciosamente para ordenar: permite inferencia aunque el DTO lo oculte.
- Recalcular jitter en cada GET: respuestas repetidas podrían reducir la protección.
- Conservar domicilios de adopción: no existe una finalidad funcional que justifique ese dato.
- Google Maps/geocoding externo: introduce coste, claves y tratamiento externo fuera del alcance.

## Consecuencias

La distancia pública es deliberadamente aproximada. El mapping EWKB/WKT de `geography` queda localizado en persistencia y el dominio solo recibe coordenadas tipadas. PostGIS debe estar disponible en desarrollo, test, CI y producción. El radio visible y la separación de DTOs son parte del control de privacidad, no detalles de presentación.

No entran en esta decisión geocoding, tracking, rutas, pgvector, mapas de producción ni funcionalidades posteriores.
