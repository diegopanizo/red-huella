# Política y estrategia de seguridad

## Alcance y estado

Este documento describe la estrategia de seguridad prevista para Red Huella. El proyecto está en Milestone 0 y no procesa todavía cuentas, publicaciones, imágenes ni ubicaciones.

### Implementado

- TypeScript estricto está habilitado en la configuración inicial de la API.
- Frontend y API compilan con TypeScript estricto y comprobaciones adicionales de índices y propiedades opcionales.
- La API aplica Helmet, limita JSON a 100 KB y usa CORS con el origen de desarrollo configurado mediante `WEB_ORIGIN`.
- `NODE_ENV`, `PORT` y `WEB_ORIGIN` se validan con Zod; los valores predeterminados solo representan el entorno local actual.
- El health endpoint no expone secretos, variables, rutas ni versiones del sistema.
- No se han encontrado secretos hardcodeados en el código fuente inspeccionado.

### Planificado

Todos los demás controles descritos aquí están planificados y deberán verificarse mediante código, configuración y tests antes de considerarse implementados. La configuración CORS definitiva de producción también sigue pendiente.

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

## Autenticación y sesiones planificadas

- La estrategia concreta de sesión se decidirá mediante ADR antes de implementarla.
- Las contraseñas se almacenarán únicamente como hashes con salt mediante un algoritmo adecuado (por ejemplo, Argon2id, sujeto a decisión y benchmark).
- Si se eligen cookies de sesión, serán `HttpOnly`, `Secure` en producción y con `SameSite` definido conscientemente.
- Login, recuperación y operaciones sensibles tendrán protección frente a fuerza bruta.
- Tokens y sesiones tendrán expiración, rotación o revocación acorde al riesgo.

## Autorización planificada

La API será la autoridad. Se validarán identidad, rol, propiedad del recurso y estado de la operación en cada caso de uso. Ocultar controles en React solo mejora la experiencia y nunca sustituye estas comprobaciones.

## Entradas, CORS y base de datos

- Parámetros, body, query y variables de entorno se validarán con schemas y límites explícitos.
- CORS usará una allowlist de orígenes por entorno; no se combinará origen comodín con credenciales.
- La cuenta de PostgreSQL no será superusuario y tendrá solo permisos necesarios.
- Las migraciones se ejecutarán con una identidad separada cuando la infraestructura lo permita.

## Imágenes y metadatos

Los uploads no se servirán directamente sin validación. Se verificará contenido real además de extensión, se limitarán dimensiones y tamaño, y se eliminarán metadatos EXIF —especialmente GPS— antes de publicar. La similitud visual futura se comunicará como indicio, nunca como identificación segura.

## Privacidad de ubicación

El modelo futuro almacenará, si es necesario y con acceso restringido, una ubicación interna exacta y generará por separado una ubicación pública aproximada. La aproximación será persistida o calculada de modo estable para impedir que consultas repetidas reconstruyan el punto exacto. No se publicará el domicilio por defecto. Véase [docs/PRIVACY.md](docs/PRIVACY.md).

## Logs y errores

Se usarán logs estructurados con identificadores de correlación y redacción de datos sensibles. No incluirán contraseñas, tokens, cookies, coordenadas exactas ni imágenes. Los clientes recibirán errores estables y no stack traces.

## Gestión de vulnerabilidades

Las vulnerabilidades no deben publicarse en issues abiertos. Hasta definir un canal privado del proyecto, contactar directamente con la persona responsable del repositorio. El procedimiento y tiempos de respuesta se concretarán antes de hacer público el producto.
