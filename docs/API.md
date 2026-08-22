# API REST

## Estado

La base Express está implementada. Solo el endpoint técnico de salud está disponible; las áreas de negocio permanecen **PLANNED**.

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

| Namespace              | Estado  | Responsabilidad futura                     |
| ---------------------- | ------- | ------------------------------------------ |
| `/api/v1/auth`         | PLANNED | Registro, login, logout y recuperación     |
| `/api/v1/users`        | PLANNED | Perfil y derechos sobre datos personales   |
| `/api/v1/publications` | PLANNED | Publicaciones, búsqueda, filtros y estados |
| `/api/v1/animals`      | PLANNED | Datos de animales asociados                |
| `/api/v1/favorites`    | PLANNED | Favoritos del usuario autenticado          |
| `/api/v1/matches`      | PLANNED | Posibles coincidencias y feedback          |
| `/api/v1/shelters`     | PLANNED | Protectoras                                |
| `/api/v1/reports`      | PLANNED | Reportes de contenido                      |
| `/api/v1/admin`        | PLANNED | Operaciones restringidas de moderación     |

## Borrador de recursos MVP

Todos estos endpoints son **PLANNED** y se concretarán por milestone:

- `POST /api/v1/auth/register`, `POST /login`, `POST /logout`.
- `GET/PATCH /api/v1/users/me` y operación futura de eliminación.
- `GET/POST /api/v1/publications`.
- `GET/PATCH/DELETE /api/v1/publications/{publicationId}` con semántica de borrado por definir.
- Operaciones de imágenes bajo una ruta y flujo aún por diseñar.
- `GET/POST/DELETE /api/v1/favorites` o recurso anidado equivalente, pendiente de ADR de contrato.

## Estados HTTP y seguridad

Se usan actualmente `200`, `404`, `500` y `503`; el resto se incorporará con endpoints reales. Cada respuesta incluye `X-Request-Id`; los errores incluyen el mismo ID en JSON. Los cuerpos JSON están limitados a 100 KB y solo se procesan como `application/json`.

## Versionado

`v1` permite evolución incompatible explícita. Cambios compatibles se añadirán sin romper clientes. Antes de implementar cada área se documentarán schemas, ejemplos, estados, permisos, paginación e idempotencia.
