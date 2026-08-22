# Política y estrategia de seguridad

## Seguridad frontend

- `/auth/me` es la única fuente de verdad de identidad; no se usan JWT, `localStorage` ni `sessionStorage`.
- `fetch` incluye credenciales, pero JavaScript no lee ni modifica la cookie HttpOnly.
- Las rutas protegidas son una medida UX; Express sigue validando sesión, Origin y ownership.
- No se usa `dangerouslySetInnerHTML` ni se almacenan passwords tras los formularios.
- Un 403 se muestra como falta de permisos sin cerrar sesión; errores inesperados pueden mostrar el request ID.

## Publicaciones implementadas en Milestone 5

- Toda mutación exige sesión y Origin exacto contra `WEB_ORIGIN`.
- El propietario procede exclusivamente de `request.auth.userId`; `userId` del body se rechaza.
- La API devuelve 404 si no existe y 403 si existe pero pertenece a otro usuario.
- DTOs allowlist excluyen email, password hash, sesión e identificadores internos de ownership.
- Zod limita strings, enums, UUID, coordenadas, edad y paginación; no se aceptan columnas de orden arbitrarias.
- Status solo cambia mediante el endpoint dedicado y su matriz de transiciones.
- El body y las coordenadas exactas no se incluyen en logs.

## Autenticación implementada en Milestone 4

- Contraseñas Argon2id (19 MiB, 2 iteraciones, paralelismo 1, salida 32 bytes), con comprobación futura de rehash.
- Tokens opacos aleatorios de 256 bits; PostgreSQL guarda únicamente SHA-256, con expiración a siete días y revocación.
- Cookie `red_huella_session` HttpOnly, SameSite Strict, `Path=/api/v1`, Max-Age/Expires y Secure en producción. El alcance permite autenticación en toda la API sin ampliarlo innecesariamente a `/`.
- Registro público forzado a `USER`, DTO explícito sin hashes y errores genéricos de login con verificación dummy.
- Origin exacto contra `WEB_ORIGIN` en POST de autenticación, además de CORS explícito con credenciales.
- Rate limiting en memoria: producción 8 logins/15 minutos y 5 registros/hora por IP; desarrollo/test usa 100.
- El logger no registra bodies/headers y redacta password, passwordHash, token, tokenHash, cookie y Authorization.

Siguen planificados recuperación de contraseña, verificación de email, MFA si el riesgo lo exige, moderación administrativa, rate limiting distribuido y autorización por propiedad de recurso.

## Alcance y estado

Este documento describe la estrategia de seguridad de Red Huella. El proyecto ha completado el Milestone 4 y expone autenticación, pero todavía no endpoints funcionales de publicaciones.

### Implementado

- TypeScript estricto está habilitado en la configuración inicial de la API.
- Frontend y API compilan con TypeScript estricto y comprobaciones adicionales de índices y propiedades opcionales.
- La API aplica Helmet, limita JSON a 100 KB y usa CORS con el origen de desarrollo configurado mediante `WEB_ORIGIN`.
- `NODE_ENV`, `PORT`, `WEB_ORIGIN`, `DATABASE_URL` y `LOG_LEVEL` son obligatorias y se validan con Zod al arrancar.
- Los errores tienen códigos estables, request ID y mensajes sanitizados; no incluyen stack ni detalles SQL.
- Cada request recibe un UUID aleatorio interno y los logs Pino omiten bodies/headers y redactan claves sensibles.
- El pool PostgreSQL es centralizado, limitado y convierte fallos de conexión en errores de base de datos.
- El schema impone enums, claves foráneas, unicidad de email, email lowercase, coordenadas válidas y posiciones de imagen no negativas.
- Las operaciones de repository usan Drizzle y queries parametrizadas; el logging SQL detallado está desactivado.
- Los tests PostgreSQL exigen `NODE_ENV=test`, URL distinta y nombre de base terminado en `_test` antes de limpiar filas.
- El health endpoint no expone secretos, variables, rutas ni versiones del sistema y devuelve 503 si PostgreSQL no responde.
- No se han encontrado secretos hardcodeados en el código fuente inspeccionado.

### Planificado

Siguen planificados recuperación y verificación de email, moderación y rate limiting distribuido. El backend de imágenes ya aplica transporte multipart acotado, procesamiento seguro, ownership, política por estado y entrega controlada por API.

## Principios

- Secure by Design y Privacy by Design desde los requisitos.
- Mínimo privilegio para usuarios, servicios, base de datos y CI/CD.
- Defensa en profundidad: validación, autorización, límites y observabilidad independientes.
- Denegación por defecto y errores sin detalles internos.
- Minimización de datos y retención limitada.
- Referencia progresiva a OWASP Top 10 y requisitos aplicables de OWASP ASVS.

## Amenazas previstas y mitigaciones

| Amenaza                    | Estrategia planificada                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Robo de credenciales       | Hash de contraseña con algoritmo resistente y parámetros revisables; TLS; sesiones revocables; no registrar credenciales            |
| Enumeración de usuarios    | Respuestas homogéneas, rate limiting y flujos de recuperación no reveladores                                                        |
| XSS                        | Escape de React, evitar HTML no confiable, sanitización cuando proceda y CSP evaluada                                               |
| CSRF                       | Si se usan cookies, `SameSite`, tokens CSRF según el flujo y validación de origen                                                   |
| SQL Injection              | Queries parametrizadas mediante repository; validación y permisos mínimos de BD                                                     |
| Abuso de uploads           | Allowlist de tipos reales, tamaño y número limitados, nombres generados, almacenamiento aislado, análisis y reprocesado de imágenes |
| Exposición de ubicaciones  | Coordenada exacta privada separada de una representación pública aproximada                                                         |
| Abuso de API               | Rate limiting por riesgo, límites de payload, paginación, timeouts y monitorización                                                 |
| Filtración de secretos     | Variables de entorno, almacén de secretos en despliegue, rotación y escaneo en CI                                                   |
| Acceso horizontal indebido | Autorización backend por acción y recurso, con tests negativos                                                                      |

## Autenticación y sesiones

- La estrategia vigente está definida en ADR-018 y usa sesiones opacas PostgreSQL.
- Las contraseñas se almacenan únicamente como hashes Argon2id con salt generado por la librería.
- Las cookies son `HttpOnly`, `Secure` en producción y `SameSite=Strict`.
- Login y registro tienen protección por IP frente a fuerza bruta; recuperación sigue pendiente.
- Tokens y sesiones expiran y pueden revocarse; la rotación adicional se evaluará según riesgo.

## Autorización planificada

La API será la autoridad. Se validarán identidad, rol, propiedad del recurso y estado de la operación en cada caso de uso. Ocultar controles en React solo mejora la experiencia y nunca sustituye estas comprobaciones.

## Entradas, CORS y base de datos

- Parámetros, body, query y variables de entorno se validarán con schemas y límites explícitos.
- CORS usará una allowlist de orígenes por entorno; no se combinará origen comodín con credenciales.
- La cuenta de PostgreSQL no será superusuario y tendrá solo permisos necesarios.
- Las migraciones se ejecutarán con una identidad separada cuando la infraestructura lo permita.

## Imágenes y metadatos

Los uploads no se sirven directamente ni se confía en filename, extensión o MIME declarado. Multer 2.2 limita el transporte a seis archivos, 8 MiB por archivo y 24 MiB agregados, rechaza campos inesperados y usa nombres temporales UUID fuera del árbol público; el cleanup se comparte entre finalización, cierre y controller. `SharpImageProcessor` sigue siendo la autoridad: acepta únicamente `metadata.format` JPEG, PNG o WebP, aplica 25 megapíxeles y 10.000 px por eje, conserva las protecciones de libvips y rechaza animación/multipágina antes de normalizar.

El procesador autorrota, convierte el color a sRGB, elimina EXIF/GPS/ICC/XMP/IPTC y no conserva originales. Preserva alpha sin aplanar transparencia y genera WebP display hasta 2048 px y thumbnail hasta 640 px, ambos sin ampliación. Cada variante tiene bytes, dimensiones y SHA-256 propios. Los errores públicos son estables y no contienen mensajes de Multer, Sharp, SQL o storage. Las keys son generadas por servidor, el root local queda fuera de assets públicos y la resolución valida formato y contención. Las mutaciones exigen Origin, sesión, ownership y estado permitido; la entrega usa lookup por UUID, `nosniff`, ETag por variante y `private, no-cache, max-age=0, must-revalidate`. Una publicación archivada devuelve 404 salvo a su owner. Ningún DTO expone keys o paths. El upload tiene rate limit por IP de 10 peticiones/15 minutos en producción y 100 en desarrollo/test; al ser memoria local no coordina varias instancias.

## Privacidad de ubicación

El modelo futuro almacenará, si es necesario y con acceso restringido, una ubicación interna exacta y generará por separado una ubicación pública aproximada. La aproximación será persistida o calculada de modo estable para impedir que consultas repetidas reconstruyan el punto exacto. No se publicará el domicilio por defecto. Véase [docs/PRIVACY.md](docs/PRIVACY.md).

## Logs y errores

Se usarán logs estructurados con identificadores de correlación y redacción de datos sensibles. No incluirán contraseñas, tokens, cookies, coordenadas exactas ni imágenes. Los clientes recibirán errores estables y no stack traces.

## Gestión de vulnerabilidades

Las vulnerabilidades no deben publicarse en issues abiertos. Hasta definir un canal privado del proyecto, contactar directamente con la persona responsable del repositorio. El procedimiento y tiempos de respuesta se concretarán antes de hacer público el producto.

La auditoría del Milestone 2 detectó cuatro avisos moderados en dependencias de desarrollo transitivas de `drizzle-kit`, originados por una versión antigua de `esbuild`. La corrección automática propuesta rebajaría Drizzle Kit con un cambio mayor, por lo que no se aplicó sin validación. Drizzle Studio no debe exponerse a redes no confiables; el riesgo se revisará al actualizar el toolkit.
