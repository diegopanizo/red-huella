# API REST

## Publicaciones implementadas

| Método | Ruta                              | Acceso          | Descripción                                   |
| ------ | --------------------------------- | --------------- | --------------------------------------------- |
| POST   | `/api/v1/publications`            | sesión + Origin | Crea animal y publicación atómicamente; `201` |
| GET    | `/api/v1/publications`            | público         | Lista paginada y filtrada                     |
| GET    | `/api/v1/publications/mine`       | sesión          | Lista todas las publicaciones propias         |
| GET    | `/api/v1/publications/:id/manage` | owner           | Datos editables con ubicación exacta privada  |
| GET    | `/api/v1/publications/:id`        | público         | Detalle no archivado                          |
| PATCH  | `/api/v1/publications/:id`        | owner + Origin  | Edita publicación y animal atómicamente       |
| PATCH  | `/api/v1/publications/:id/status` | owner + Origin  | Resuelve, adopta o archiva                    |

Listado: `page=1`, `pageSize=20` (máximo 100), filtros `type`, `status`, `species` y orden `newest`, `oldest`, `eventDate` o `distance`. Sin filtro de estado solo aparecen `ACTIVE`; `ARCHIVED` nunca aparece en el listado público. `/mine` incluye estados no públicos.

La búsqueda geográfica amplía el mismo listado con `latitude`, `longitude` y `radiusMeters`, que deben aparecer conjuntamente. El radio permitido es 500–100.000 m y `order=distance` exige esos tres parámetros. PostGIS filtra y calcula distancias exclusivamente desde `public_location`; una fila sin ubicación pública queda fuera. `distanceMeters` solo aparece en una búsqueda geográfica y se redondea a 100 m por debajo de 10 km o a 1 km desde 10 km.

El DTO público contiene `publicLocation {latitude,longitude,radiusMeters}` o `null`, nunca exacta ni legacy, además de publicación, animal, imágenes y autor `{id,name,role}`. `GET /:id/manage` exige sesión y ownership, responde `Cache-Control: private, no-store` y añade `exactLocation`; en ADOPTION siempre es `null`. No devuelve formatos PostGIS ni versión de privacidad. LOST/FOUND no aceptan fecha futura.

El PATCH permite cambiar `type`. La política se reaplica al tipo final dentro de la actualización atómica. LOST/FOUND → ADOPTION elimina exacta; ADOPTION → LOST/FOUND requiere una nueva ubicación si se omite `location`, aunque `location: null` permite expresar deliberadamente una publicación sin ubicación.

El cliente web tipa `publicLocation` como `{ latitude, longitude, radiusMeters }` y el resultado owner como el DTO público más `exactLocation: { latitude, longitude } | null`. En PATCH omite `location` si no cambió, envía el punto solo al modificarlo y envía `null` al quitarlo.

## Autenticación implementada

Todos los POST requieren `Origin` igual a `WEB_ORIGIN`. Registro y login establecen `red_huella_session` con `Path=/api/v1`, alcance suficiente para toda la API autenticada y menor que `/`; el cliente debe incluir credenciales. Ninguna respuesta expone hashes o tokens.

| Método | Ruta                    | Body                        | Éxito                   | Errores principales    |
| ------ | ----------------------- | --------------------------- | ----------------------- | ---------------------- |
| POST   | `/api/v1/auth/register` | `name`, `email`, `password` | `201 { user }` + cookie | 400, 409, 429          |
| POST   | `/api/v1/auth/login`    | `email`, `password`         | `200 { user }` + cookie | 400, 401 genérico, 429 |
| POST   | `/api/v1/auth/logout`   | ninguno                     | `204` + cookie expirada | 403 por Origin         |
| GET    | `/api/v1/auth/me`       | ninguno                     | `200 { user }`          | 401                    |

`user` contiene exclusivamente `id`, `name`, `email` y `role`. Logout es idempotente. Los errores siguen `{ error: { code, message, requestId } }`.

## Estado

La base Express y los endpoints de autenticación, publicaciones, imágenes y búsqueda geográfica están implementados. El frontend consume estos contratos para gestión, mapas aproximados y búsqueda cercana.

El modelo y repositories de `users`, `animals` y `publications` son internos. No se han creado endpoints temporales ni se expone acceso directo a persistencia.

## Endpoint implementado

`GET /api/v1/health`

- HTTP `200`: `{ "status": "ok", "database": "ok" }`.
- HTTP `503`: `{ "status": "error", "database": "unavailable" }`.
- No requiere autenticación.
- Comprueba readiness de la API y PostgreSQL. No se separa liveness todavía porque existe un único proceso/dependencia y no aporta operación adicional en esta fase.
- No expone variables, host, usuario, versiones, rutas internas ni errores del driver.

## Convenciones previstas

- Base path: `/api/v1`.
- HTTPS obligatorio fuera del entorno local.
- JSON para requests/responses salvo el upload de imágenes, que usa `multipart/form-data`.
- Validación de path, query y body en el límite.
- Autorización de acción y recurso en backend.
- Identificador de correlación y formato de error estable sin stack traces.
- Paginación y límites máximos para colecciones.
- Fechas ISO 8601 en UTC; coordenadas y precisión sujetas a privacidad.

Formato de error implementado para fallos globales y rutas desconocidas:

```json
{
  "error": {
    "code": "APP_NOT_FOUND",
    "message": "Recurso no encontrado",
    "requestId": "..."
  }
}
```

## Áreas previstas

| Namespace              | Estado      | Responsabilidad futura                                             |
| ---------------------- | ----------- | ------------------------------------------------------------------ |
| `/api/v1/auth`         | IMPLEMENTED | Registro, login, logout y usuario actual; recuperación planificada |
| `/api/v1/users`        | PLANNED     | Perfil y derechos sobre datos personales                           |
| `/api/v1/publications` | IMPLEMENTED | CRUD, filtros, ownership, estados y búsqueda geográfica pública    |
| `/api/v1/animals`      | PLANNED     | Datos de animales asociados                                        |
| `/api/v1/favorites`    | PLANNED     | Favoritos del usuario autenticado                                  |
| `/api/v1/matches`      | PLANNED     | Posibles coincidencias y feedback                                  |
| `/api/v1/shelters`     | PLANNED     | Protectoras                                                        |
| `/api/v1/reports`      | PLANNED     | Reportes de contenido                                              |
| `/api/v1/admin`        | PLANNED     | Operaciones restringidas de moderación                             |

## Borrador de recursos MVP

Salvo los endpoints de auth y publicaciones documentados como implementados, estos endpoints son **PLANNED** y se concretarán por milestone:

- Recuperación de contraseña y verificación de email bajo auth.
- `GET/PATCH /api/v1/users/me` y operación futura de eliminación.
- Eliminación física de publicaciones, si se justifica en un milestone futuro.
- La UI de imágenes y el adaptador de object storage S3/R2 siguen pendientes; el backend descrito debajo está implementado.

## Contrato implementado de imágenes

| Método | Ruta                                                  | Acceso                 | Resultado                                             |
| ------ | ----------------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| POST   | `/api/v1/publications/:publicationId/images`          | owner + Origin         | `201 { images }`; multipart, campo repetible `images` |
| DELETE | `/api/v1/publications/:publicationId/images/:imageId` | owner + Origin         | `204`; metadata y outbox atómicas                     |
| PATCH  | `/api/v1/publications/:publicationId/images/order`    | owner + Origin         | `200 { images }`; body `{ imageIds: UUID[] }`         |
| GET    | `/api/v1/publication-images/:imageId/content`         | público salvo archived | stream WebP display                                   |
| GET    | `/api/v1/publication-images/:imageId/thumbnail`       | público salvo archived | stream WebP thumbnail                                 |

Máximo seis imágenes por publicación, 8 MiB por entrada y 24 MiB por petición. `ACTIVE`, `RESOLVED` y `ADOPTED` permiten al owner agregar, eliminar y reordenar; `ARCHIVED` solo eliminar. Reorder exige exactamente todos los IDs actuales, sin duplicados; posición cero es principal. Las respuestas entregan `id`, `position`, `url`, `thumbnailUrl`, `width` y `height`, nunca keys, checksums ni rutas internas.

Display y thumbnail usan checksum propio como ETag, admiten `If-None-Match`/`304` y responden `Cache-Control: private, no-cache, max-age=0, must-revalidate`. En archived, anónimo u otro usuario recibe 404. Errores específicos: `IMAGE_UPLOAD_EMPTY`, `IMAGE_TOO_MANY`, `IMAGE_FILE_TOO_LARGE`, `IMAGE_REQUEST_TOO_LARGE`, `IMAGE_NOT_FOUND`, `IMAGE_FORBIDDEN`, `IMAGE_INVALID_ORDER`, `IMAGE_UPLOAD_NOT_ALLOWED_FOR_STATUS`, errores de procesamiento estables y `STORAGE_OPERATION_FAILED`.

- `GET/POST/DELETE /api/v1/favorites` o recurso anidado equivalente, pendiente de ADR de contrato.

## Estados HTTP y seguridad

Se usan actualmente `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `429`, `500` y `503`. Cada respuesta incluye `X-Request-Id`; los errores incluyen el mismo ID en JSON. Los cuerpos JSON están limitados a 100 KB y solo se procesan como `application/json`.

## Versionado

`v1` permite evolución incompatible explícita. Cambios compatibles se añadirán sin romper clientes. Antes de implementar cada área se documentarán schemas, ejemplos, estados, permisos, paginación e idempotencia.
