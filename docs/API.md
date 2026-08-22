# API REST

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

La base Express y los endpoints de autenticación están implementados. Las áreas de negocio permanecen **PLANNED**.

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
- JSON para requests/responses salvo uploads, cuyo diseño queda pendiente.
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
| `/api/v1/publications` | PLANNED     | Publicaciones, búsqueda, filtros y estados                         |
| `/api/v1/animals`      | PLANNED     | Datos de animales asociados                                        |
| `/api/v1/favorites`    | PLANNED     | Favoritos del usuario autenticado                                  |
| `/api/v1/matches`      | PLANNED     | Posibles coincidencias y feedback                                  |
| `/api/v1/shelters`     | PLANNED     | Protectoras                                                        |
| `/api/v1/reports`      | PLANNED     | Reportes de contenido                                              |
| `/api/v1/admin`        | PLANNED     | Operaciones restringidas de moderación                             |

## Borrador de recursos MVP

Salvo los endpoints de auth ya documentados como implementados, estos endpoints son **PLANNED** y se concretarán por milestone:

- Recuperación de contraseña y verificación de email bajo auth.
- `GET/PATCH /api/v1/users/me` y operación futura de eliminación.
- `GET/POST /api/v1/publications`.
- `GET/PATCH/DELETE /api/v1/publications/{publicationId}` con semántica de borrado por definir.
- Operaciones de imágenes bajo una ruta y flujo aún por diseñar.
- `GET/POST/DELETE /api/v1/favorites` o recurso anidado equivalente, pendiente de ADR de contrato.

## Estados HTTP y seguridad

Se usan actualmente `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `429`, `500` y `503`. Cada respuesta incluye `X-Request-Id`; los errores incluyen el mismo ID en JSON. Los cuerpos JSON están limitados a 100 KB y solo se procesan como `application/json`.

## Versionado

`v1` permite evolución incompatible explícita. Cambios compatibles se añadirán sin romper clientes. Antes de implementar cada área se documentarán schemas, ejemplos, estados, permisos, paginación e idempotencia.
