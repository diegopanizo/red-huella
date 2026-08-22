# Estrategia de testing

## Frontend funcional

Vitest, React Testing Library y jsdom prueban render tras loading, card/placeholder, filtros en URL, empty state, redirección protegida, validación de registro y submit de login con `credentials: include`. Se prueban resultados observables, no snapshots.

## Publicaciones

Tests unitarios cubren schemas, límites de paginación, DTO y matriz de estados. La suite PostgreSQL prueba los tres tipos, filtros, orden, paginación, lectura, dos usuarios con ownership, Origin, auth, edición compuesta, transiciones, `/mine` y rollback real de create/update.

## Cobertura de autenticación

Vitest cubre Argon2id, tokens, expiración, cookies y schemas. La suite PostgreSQL separada verifica users/sessions, unicidad, expiración, revocación y el flujo HTTP completo registro → `/me` → logout → 401. También prueba escalada de rol, duplicados, Origin, credenciales genéricas y 429. Los safeguards de `_test` siguen siendo obligatorios.

## Estado

**Base implementada.** Vitest se ejecuta por workspace desde la raíz. El frontend usa React Testing Library con jsdom y la API usa Supertest sin abrir un puerto real.

El Bloque 1 del Milestone 7 añade tests unitarios de generación de keys y `LocalImageStorage`: directorios temporales reales del sistema, escritura/lectura, no sobrescritura, rechazo de traversal/keys ajenas y borrado idempotente. La suite PostgreSQL valida la migración aditiva, grupos de metadatos y outbox.

El Bloque 2 genera todas sus fixtures en memoria con Sharp y cubre JPEG/PNG/WebP, normalización, tamaños, no ampliación, autorrotación, eliminación de EXIF/GPS/ICC, sRGB, alpha, metadatos y checksums de salida. También cubre SVG, GIF, HEIF, animación GIF/WebP, corrupción, 8 MiB, 25 MP y 10.000 px. No hay binarios versionados, red ni archivos externos.

El Bloque 3 añade Supertest con PostgreSQL y directorios temporales reales. Cubre multipart JPEG/PNG/WebP, límites por archivo/petición/capacidad, SVG/GIF/HEIF y corrupción, auth/Origin/ownership, matriz ACTIVE/RESOLVED/ADOPTED/ARCHIVED, uploads concurrentes, reordenación densa, borrado y compactación, outbox completada o pendiente, compensación ante fallo de storage/DB, contenido público/archivado, objeto ausente, ETag/304 y ausencia de keys/paths en DTOs.

El Bloque 4 usa RTL/jsdom para selector múltiple, previews y revocación de object URLs, límites UX, FormData sin Content-Type manual, orden JSON → multipart, fallo parcial y reintento sin duplicado. También prueba thumbnail/placeholder de cards, galería seleccionable y fallback roto, upload/delete/reorder owner, archived, capacidad y la invalidación de detalle, mine y listado.

Tests actuales:

- `apps/web/src/App.test.tsx`: comprueba que la interfaz inicial renderiza su encabezado y botón principal.
- `apps/api/src/config/env.test.ts`: configuración válida, obligatoria ausente y valores inválidos.
- `apps/api/src/errors/app-error.test.ts`: jerarquía, códigos y sanitización de errores desconocidos.
- `apps/api/src/services/health.service.test.ts`: PostgreSQL disponible y no disponible.
- `apps/api/src/app.test.ts`: health 200/503, request ID, 404 y contrato de error sanitizado.
- `apps/api/src/repositories/normalize-email.test.ts`: normalización determinista de email.
- `apps/api/src/database/test-database.test.ts`: safeguards para impedir limpieza fuera de una base `_test` separada.

La cobertura incluye reglas de autenticación, publicaciones, imágenes y geolocalización; los recorridos E2E completos siguen planificados.

## Ejecución

`npm run test` ejecuta unitarios e integración HTTP sin watch. `npm run test:watch` es solo para desarrollo. La configuración de Vitest aporta variables sintéticas; ninguna prueba conecta accidentalmente a una base real.

## Estrategia de base de datos

Los unitarios inyectan un `DatabaseProbe` controlado y Supertest usa la aplicación sin puerto. La suite normal no necesita PostgreSQL.

La suite `npm run test:db` usa PostgreSQL real, aplica migrations y valida tablas, inserts, unicidad de email, animales, publicaciones, FKs, coordenadas, imágenes y `findById`. No usa SQLite ni mocks como sustituto. Requiere `NODE_ENV=test`, `DATABASE_TEST_URL` distinta de desarrollo y nombre terminado en `_test`; limpia filas con `DELETE` en orden seguro, nunca `DROP`/`TRUNCATE`.

Milestone 8 añade unitarios de radios, CSPRNG inyectable, desplazamiento esférico en ecuador/latitudes altas/antimeridiano, retención por tipo, estabilidad y regeneración. Los tests de mapping prueban que el DTO público no expone exacta ni legacy y no aplica fallback. La suite DB PostGIS ejecuta extensión, geography/SRID, constraints, GiST, roundtrip, distancia, ADOPTION y backfill/idempotencia sobre `0003` aplicada en la base de test aislada.

El Bloque 4 prueba `LocationPicker` sin inspeccionar internals de Leaflet: selección/eliminación, entrada manual completa e incompleta, geolocalización voluntaria, permiso denegado y ausencia de API. Las pruebas de aplicación verifican textos por tipo, create con ubicación, carga owner desde `/manage`, omisión de `location` sin cambios y la protección ADOPTION → LOST/FOUND. React-Leaflet se sustituye por un doble en JSDOM; la interacción real del mapa se valida manualmente.

Checklist manual del Bloque 4:

1. Crear LOST: seleccionar en mapa, guardar y comprobar que el detalle funciona.
2. Editar LOST: confirmar el marcador exacto owner, moverlo y guardar.
3. Crear FOUND y comprobar el texto de zona aproximada de 1,5 km.
4. Crear ADOPTION y comprobar el aviso de no publicar domicilio exacto.
5. Cambiar ADOPTION a LOST: verificar que exige un punto nuevo o la decisión explícita de quitar ubicación.
6. Pulsar **Usar mi ubicación**: comprobar que el permiso aparece solo tras el click.
7. Denegar geolocalización: comprobar el mensaje y que mapa/entrada manual siguen operativos.
8. Desactivar red o bloquear tiles: comprobar el aviso y guardar usando coordenadas manuales.

El Bloque 5 prueba el componente público por contrato: contexto LOST/FOUND/ADOPTION, radio del círculo, atribución OSM y ausencia de coordenadas textuales. Las pruebas de `Home` verifican que no se solicita geolocalización al cargar, que el click genera `latitude`, `longitude`, radio 25 km y `order=distance`, que radio/filtros provocan nuevas consultas sin repetir permiso y que quitar cercanía vuelve a una query normal. También cubren permiso denegado, indisponibilidad, timeout y navegador sin API sin bloquear el listado.

Checklist manual del Bloque 5:

1. Abrir un detalle LOST con ubicación y comprobar el círculo aproximado.
2. Verificar que el detalle no presenta coordenadas ni marcador exacto.
3. En Explorar, pulsar **Buscar cerca de mí** y aceptar el permiso.
4. Comprobar el mensaje de búsqueda activa, el orden por cercanía y las distancias aproximadas.
5. Cambiar el radio de 25 km a 5 km y comprobar el refresco.
6. Cambiar especie, tipo y estado comprobando que la cercanía permanece activa.
7. Quitar la búsqueda cercana y verificar el regreso al listado normal.
8. Denegar el permiso y confirmar que el listado normal sigue utilizable.
9. Abrir un detalle ADOPTION y confirmar que se describe como zona de referencia, no como domicilio.
10. Bloquear los tiles y confirmar que el resto del detalle permanece legible.

El Bloque 3 cubre redondeo público, validación completa de query, create por tipo, campos protegidos, estabilidad/regeneración, retirada y transiciones de tipo. Supertest/PostGIS verifica `/manage`, auth/ownership/cache, radio y orden estable, filtros combinados, null/archived, distancia redondeada y un dataset con exacta/pública deliberadamente separadas. La suite DB comprueba fronteras `ST_DWithin`, distancia en metros y existencia de GiST sin imponer un plan frágil sobre pocas filas.

## Pirámide prevista

### Tests unitarios

- Frontend con Vitest: utilidades, schemas, hooks y lógica de aplicación aislable.
- Backend con Vitest: casos de uso, reglas, transiciones de estado, autorización contextual y matching tradicional.
- Deben ser rápidos, deterministas y probar resultados observables, incluidos límites y errores.

### Tests de integración

- React Testing Library para interacción accesible de componentes, formularios y estados de carga/error.
- Supertest para rutas Express, validación, autenticación/autorización, códigos y bodies.
- Repositories contra una base de datos de test real cuando exista persistencia; no sustituir semántica de PostgreSQL con mocks incompatibles.

### End-to-End

Playwright se añadirá en el Milestone 12 para recorridos críticos: identidad, publicar, buscar, proteger ubicación, favoritos y moderación cuando existan. Se ejecutará en un entorno aislado con datos sintéticos.

## Qué probar

- Comportamiento y reglas, no detalles internos.
- Casos válidos, límites, datos malformados, estados vacíos y fallos de dependencias.
- Acceso anónimo, rol incorrecto, recurso ajeno y transiciones prohibidas.
- Ausencia de coordenadas privadas y metadatos sensibles en respuestas públicas.
- Accesibilidad básica, navegación por teclado y nombres accesibles.
- Contratos de API, serialización y migraciones futuras.
- Matching con fixtures explicables y tolerancias declaradas.

## Qué no es un test válido

- Aserciones triviales como `2 + 2 = 4` sin relación con el producto.
- Tests que solo comprueban que un mock devuelve lo configurado.
- Snapshots enormes sin intención revisable.
- Ignorar, saltar o capturar errores para obtener verde.
- Depender de red externa, reloj real o datos personales sin aislamiento.

## Calidad y CI

Cada corrección incorporará una regresión cuando sea viable. La CI ejecuta calidad sin base en el job principal y `test:db` en un job separado con PostgreSQL 17 y credenciales efímeras. Los E2E permanecen fuera de alcance.

## Datos de prueba

Solo datos sintéticos y fábricas deterministas. Las imágenes de prueba deben tener licencia compatible y metadatos controlados. Cada suite limpiará su estado sin apuntar a producción.
