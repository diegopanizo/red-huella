# ADR-021 — Imágenes normalizadas y almacenamiento desacoplado

**Estado:** Accepted  
**Milestone:** 7

## Contexto

Las publicaciones necesitan hasta seis imágenes reales sin guardar binarios en PostgreSQL ni acoplar negocio a un proveedor. El roadmap anterior asignaba Milestone 7 a geolocalización y Milestone 8 a imágenes.

## Decisión

- Imágenes pasa oficialmente a Milestone 7; geolocalización/PostGIS pasa a Milestone 8. Se conserva este registro del orden anterior.
- El navegador creará primero la publicación JSON y subirá después sus imágenes mediante multipart.
- Se aceptarán JPEG, PNG y WebP, comprobando expresamente `metadata.format` con Sharp. Decodificar no basta para admitir un formato.
- Límites: 6 imágenes por publicación, 8 MiB por entrada, 24 MiB por petición, 25 megapíxeles decodificados y 10.000 px por eje.
- Cada entrada se autorrotará, perderá EXIF/GPS/metadatos y se re-encodeará sin conservar el original: `display.webp` hasta 2048 px y `thumbnail.webp` hasta 640 px.
- PostgreSQL guardará keys, MIME normalizado, dimensiones, bytes y checksum SHA-256 independiente por variante. `position = 0` identifica la principal.
- `ImageStorage` define escritura exclusiva, lectura y borrado idempotente. Desarrollo usa `LocalImageStorage`; S3/R2 queda como adaptador futuro.
- Las keys las genera el servidor: `publications/{publicationId}/{imageId}/{display|thumbnail}.webp`. No son URLs ni forman parte del DTO público.
- `ACTIVE`, `RESOLVED` y `ADOPTED` permiten al owner agregar, eliminar y reordenar. `ARCHIVED` permite eliminar, no agregar ni reordenar.
- La eliminación de objetos usa exclusivamente la outbox pequeña `storage_deletion_jobs`; no es un framework general de trabajos.
- Display y thumbnail tendrán checksum/ETag independientes. No se usará caché pública immutable de larga duración porque una publicación puede archivarse.
- El seed normal no contendrá keys ficticias ni binarios demo.

## Consistencia

El upload escribirá objetos antes de confirmar metadatos y compensará si falla PostgreSQL. El borrado retirará metadatos y creará entradas de outbox en una misma transacción; la eliminación física será idempotente y reintentable. Una reconciliación operativa futura detectará huérfanos.

## Consecuencias

El filesystem local necesita un directorio privado y persistente, permisos mínimos y backup coordinado con PostgreSQL. Una producción con varias réplicas requerirá object storage compartido.

## Concreción del procesamiento — Bloque 2

Se usa Sharp 0.35.3 con libvips precompilado y tipos propios, compatible con Node 24 y Windows. La entrada se mantiene una sola vez como buffer limitado a 8 MiB; dos pipelines lazy derivan display y thumbnail. `limitInputPixels=25_000_000`, `limitInputChannels=4`, `unlimited=false`, lectura secuencial y `failOn=warning` conservan defensas de decodificación.

La salida usa WebP quality 82, alpha quality 100, conversión a sRGB y no invoca ninguna opción de conservación de metadata: Sharp elimina EXIF —incluido GPS—, ICC, XMP e IPTC. No se aplana la imagen, por lo que PNG/WebP transparentes mantienen alpha. Frontend y adaptador S3/R2 siguen fuera de estos bloques.

## Concreción backend — Bloque 3

Se adopta Multer 2.2 para integrar multipart con Express y almacenamiento temporal en disco. Autenticación, Origin y rate limit se ejecutan antes de parsear binarios. Multer impone seis archivos, 8 MiB por archivo y solo el campo repetible `images`; la capa de transporte suma 24 MiB y Sharp conserva la autoridad sobre el formato real.

La inserción revalida owner, estado y capacidad bajo `SELECT ... FOR UPDATE` sobre la publicación. Storage se escribe antes del commit de metadata y cualquier fallo posterior activa compensación idempotente; una compensación incompleta se registra sin keys y queda sujeta a la reconciliación operativa prevista. Delete mantiene la estrategia aprobada: metadata, compactación y outbox se confirman juntas, seguidas de borrado físico best-effort. No se incorpora scheduler.

Los DTOs construyen URLs opacas desde el UUID de metadata. Content se entrega por stream tras comprobar visibilidad, con MIME WebP, `nosniff`, longitud, checksum propio como ETag y `private, no-cache, max-age=0, must-revalidate`; archivar corta el acceso anónimo y devuelve 404. Esta concreción no cambia el modelo ni requiere una migración posterior a `0002`.
