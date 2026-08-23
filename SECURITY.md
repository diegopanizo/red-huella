# Política y estrategia de seguridad

## Threat model de cierre - Milestone 12

### Activos y actores

Los activos principales son credenciales y sesiones, PII de contacto, ubicaciones exactas, publicaciones e imagenes, objetos de almacenamiento, embeddings, modelo ONNX, disponibilidad de API/PostgreSQL y configuracion de despliegue. Los actores considerados son visitantes anonimos, usuarios autenticados, propietarios de publicaciones, usuarios bloqueados, clientes automatizados abusivos y operadores con acceso al entorno. No existen roles administrativos funcionales en el producto actual.

### Fronteras de confianza

1. Navegador -> API: toda entrada HTTP es no confiable; CORS no sustituye autenticacion, Origin, validacion ni ownership.
2. API -> PostgreSQL/PostGIS/pgvector: repositories y queries parametrizadas son la frontera de persistencia; las migraciones usan un proceso separado.
3. API -> filesystem privado: solo `ImageStorage` resuelve keys generadas por servidor; uploads temporales y objetos no estan bajo assets publicos.
4. API -> Sharp/ONNX: bytes hostiles se acotan y normalizan antes de inferencia; modelo y path son configuracion operativa confiable.
5. Frontend -> navegador/servicios externos: geolocalizacion requiere accion explicita, contacto genera hosts/esquemas allowlisted y tiles OSM son solo desarrollo/demo.

### Amenazas y mitigaciones verificadas

| Amenaza                  | Escenario                                                                            | Mitigaciones actuales                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BOLA/IDOR                | Usar el UUID de otra publicacion o imagen para modificarla o leer datos owner        | Sesion en backend, `userId` tomado de `request.auth`, ownership en service/repository y 404/403 estables; `/manage` es owner-only                                                   |
| Fallos de autenticacion  | Fuerza bruta, sesion robada/fijada o usuario bloqueado                               | Argon2id, verificacion dummy, token opaco CSPRNG de 256 bits almacenado como SHA-256, cookie HttpOnly/SameSite Strict/Secure en produccion, expiracion, revocacion y usuario activo |
| CSRF/CORS                | Mutacion desde un sitio no confiable                                                 | Origin exacto en mutaciones, CORS con credenciales y allowlist unica, SameSite Strict; `WEB_ORIGIN` debe ser un origen puro y HTTPS en produccion                                   |
| Inyeccion                | SQL/PostGIS/pgvector, sort o filtros controlados por cliente                         | Zod estricto, enums/allowlists, Drizzle y plantillas `sql` parametrizadas; no hay SQL, comandos ni paths concatenados desde entrada HTTP                                            |
| Exposicion excesiva      | Email, contacto, ubicacion exacta, keys, checksum, vectores o paths en DTO/log/error | Selecciones y DTO allowlist, endpoints dedicados owner/contacto, errores estables y logger sin body/query/headers sensibles                                                         |
| Upload malicioso         | Path traversal, formato falso, EXIF/GPS, bomba de descompresion o archivo animado    | Nombres UUID, storage privado y contenido por UUID; Sharp valida formato real, pagina, 8 MiB, 25 MP y 10.000 px/eje, re-encodea WebP y elimina metadatos/original                   |
| Abuso geoespacial        | Reconstruccion o filtrado por punto exacto                                           | Toda funcion publica usa exclusivamente `public_location` persistida; exacta solo en `/manage`; geolocalizacion del visitante es voluntaria y efimera                               |
| Abuso de contacto        | Scraping de PII o URI manipulada                                                     | Autenticacion, publicacion/autor ACTIVE, revelacion bajo click, respuesta no-store, rate limit por usuario/IP y links con esquemas/host fijos                                       |
| Abuso de busqueda visual | Persistencia de query, imagen hostil, fuga de embedding/modelo o consumo excesivo    | Buffer efimero de 8 MiB, validacion Sharp, sesion+Origin, rate limit usuario/IP, respuesta reducida no-store y errores sin detalles ONNX                                            |
| Configuracion insegura   | Arranque con origen HTTP/path, secretos versionados o confianza incorrecta en proxy  | Schema fail-fast, `.env` fuera de Git, ejemplo sin secretos y `trust proxy` deshabilitado hasta definir topologia                                                                   |

### Riesgos aceptados y trabajo operativo

- La existencia de una cuenta puede inferirse mediante el `409` de registro. Ocultarla correctamente se vincula al futuro flujo de verificacion de email y recuperacion, no a un cambio aislado de copy/status.
- Contacto permanece en texto plano en PostgreSQL. Produccion requiere permisos minimos, backups cifrados y evaluacion de envelope encryption/KMS.
- Los rate limiters son por proceso. Varias instancias requieren store compartido o control equivalente en el edge.
- La busqueda visual no limita explicitamente inferencias simultaneas; deployment debe medir CPU/RSS y definir concurrencia/cola antes de exponer carga no controlada.
- La integridad y procedencia del fichero ONNX deben garantizarse en build/release; el runtime confia en el path configurado.
- La purga de sesiones expiradas y el reintento de la outbox de borrado necesitan programacion y observabilidad en el runbook.
- `trust proxy` sigue deshabilitado. Solo se configurara con la topologia exacta de proxies para no permitir spoofing de IP.

La revision OWASP Top 10 y OWASP API Security del Milestone 12 no encontro hallazgos criticos ni altos. El unico cambio de codigo fue el endurecimiento fail-fast de `WEB_ORIGIN`; los riesgos medios que requieren producto, KMS, infraestructura o medicion se aceptan explicitamente para Milestone 14.

## Persistencia de embeddings visuales

Los vectores son internos y no forman parte de contratos HTTP, logs o errores. La persistencia acepta solo 512 valores finitos con norma L2 aproximadamente uno y no normaliza silenciosamente. `markReady`/`markFailed` exigen el checksum vigente para descartar inferencias obsoletas. Los fallos se limitan a una allowlist y nunca incluyen stacks, mensajes ONNX, rutas, bytes o PII. La búsqueda futura deberá comparar solo READY del mismo modelo y revisión.

El pipeline conserva los límites JPEG/PNG/WebP, 8 MiB, 25 MP, 10.000 px y una página. Errores globales de configuración/carga abortan el backfill; solo fallos propios de una imagen se registran en su lifecycle.

El processor es opt-in, valida intervalo (5 s–1 h) y lote (1–50), mantiene concurrencia uno y nunca ejecuta ONNX en la request de upload. Sin modelo no arranca; si la carga falla se deshabilita hasta reiniciar, evitando reintentos y logs continuos. Backfill y processor usan advisory locks cooperativos, y los mensajes omiten rutas, storage keys, checksums, vectores y datos personales.

`POST /api/v1/publications/search-by-image` exige sesión y Origin confiable, limita 10 consultas/usuario y 30/IP cada 15 minutos, una imagen y 8 MiB. Sharp valida bytes, dimensiones, píxeles, formato y página antes de inferencia. La respuesta es `private, no-store`, sin ETag; los fallos globales se reducen a `VISUAL_SEARCH_UNAVAILABLE` sin detalles ONNX.

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

ADR-022 separa una ubicación interna exacta de una ubicación pública aproximada, aleatoria, persistida y versionada. Toda consulta, filtro, distancia, ordenación o mapa público usa exclusivamente `public_location`; los aggregates públicos ni siquiera seleccionan exacta/legacy y el DTO tampoco las expone. LOST y FOUND conservan exacta con zonas públicas de 1.000 y 1.500 m; ADOPTION no almacena domicilio exacto y usa una zona de 5.000 m. El modelo, migración, consultas, DTO y endpoint owner están implementados. Véase [docs/PRIVACY.md](docs/PRIVACY.md).

La API geográfica implementada valida el trío de búsqueda y radios 500–100.000 m, parametriza SQL PostGIS y excluye ubicación pública nula. `/manage` exige sesión y owner, responde `private, no-store` y no expone versión ni formatos espaciales. El logger conserva solo `request.path`, nunca query string, y no se añadieron logs de coordenadas. Errores de validación y persistencia siguen sanitizados.

El mapa global valida estrictamente bounds Web Mercator y filtros allowlist, rechaza parámetros desconocidos y `ARCHIVED`, parametriza ambos envelopes del antimeridiano y limita el repository a 501 filas. La respuesta máxima es 500, con selección mínima y sin count. Un rate limiter en memoria aplica 60 consultas/minuto/IP y devuelve el error estable `MAP_RATE_LIMITED`; despliegues multiinstancia requerirán store compartido. La caché exige revalidación y Express genera ETag.

La búsqueda cercana del navegador solicita geolocalización solo tras un click, conserva el centro en memoria y lo descarta al desactivar la búsqueda. No usa Web Storage ni añade coordenadas a analytics o logs. `PublicLocationMap` acepta exclusivamente el DTO público aproximado.

## Contacto por publicación

El Bloque 1 del Milestone 9 persiste contacto únicamente en una tabla separada, sin índices por valor ni selección desde aggregates públicos. E.164, email, unicidad por método, trim y colección máxima se validan en aplicación/base; el reemplazo completo es transaccional y retirar un método elimina su fila. No se reutiliza `users.email`.

Teléfonos y emails están inicialmente en texto normal y no pueden escribirse en logs, errores o métricas. La filtración de PostgreSQL/backups es un riesgo documentado; cifrado de backups, permisos mínimos y posible envelope encryption son requisitos de revisión antes de producción.

La configuración owner está implementada con sesión, ownership y Origin en PUT. GET/PUT responden `Cache-Control: private, no-store`, `Pragma: no-cache` y sin ETag. Un lock `FOR UPDATE` mantiene coherentes estado, colección actual y reemplazo: `ACTIVE` permite cambios; estados finales solo retirada exacta. Los errores y logs no contienen values.

La revelación protegida está implementada en `GET /publications/:id/contact`: exige usuario autenticado activo, publicación y autor activos, y métodos existentes. Una query allowlist evita cargar otros datos. Inexistencia, estado final, autor bloqueado y ausencia de métodos devuelven el mismo `404 CONTACT_NOT_AVAILABLE`. Owner no tiene bypass.

Se aplican dos buckets de 15 minutos: 30 por usuario y 100 por IP, con `429 CONTACT_RATE_LIMITED`. Son stores en memoria por proceso; despliegue multiinstancia requerirá almacenamiento distribuido. Éxito y errores posteriores a autenticación llevan `private, no-store`/`no-cache`; el 200 no emite ETag. El logger conserva metadata de request, nunca values ni response body.

El retorno tras login acepta exclusivamente rutas internas sanitizadas. Rechaza URLs absolutas, rutas `//`, esquemas arbitrarios y retornos a login/registro para evitar open redirects y bucles. La UI reconstruye enlaces de contacto desde valores validados con esquemas fijos (`https://wa.me`, `tel:` y `mailto:`); nunca representa una URI arbitraria recibida. Los parámetros con texto se codifican y la PII revelada se elimina de TanStack Query al ocultar, desmontar, cambiar de publicación o cerrar sesión.

## Logs y errores

La búsqueda visual mantiene el buffer únicamente durante la request, valida Origin y sesión, limita tamaño/formato y aplica rate limiting por usuario e IP. No registra imagen, vector, checksum, score, path del modelo ni datos personales. Los fallos de carga del modelo se traducen a un 503 estable sin detalles ONNX/filesystem; el frontend usa mensajes allowlisted.

Se usarán logs estructurados con identificadores de correlación y redacción de datos sensibles. No incluirán contraseñas, tokens, cookies, coordenadas exactas ni imágenes. Los clientes recibirán errores estables y no stack traces.

## Gestión de vulnerabilidades

Las vulnerabilidades no deben publicarse en issues abiertos. Hasta definir un canal privado del proyecto, contactar directamente con la persona responsable del repositorio. El procedimiento y tiempos de respuesta se concretarán antes de hacer público el producto.

La auditoría general de cierre del Milestone 9 mantiene cuatro avisos moderados en dependencias de desarrollo transitivas de `drizzle-kit`, originados por una versión antigua de `esbuild`. `npm audit --omit=dev` devuelve cero vulnerabilidades de runtime. La corrección automática propuesta rebajaría Drizzle Kit con un cambio mayor, por lo que no se aplicó sin validación. Drizzle Studio no debe exponerse a redes no confiables; el riesgo se revisará al actualizar el toolkit.
