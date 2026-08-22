# Estrategia de testing

## Estado

**Base implementada.** Vitest se ejecuta por workspace desde la raíz. El frontend usa React Testing Library con jsdom y la API usa Supertest sin abrir un puerto real.

Tests actuales:

- `apps/web/src/App.test.tsx`: comprueba que la interfaz inicial renderiza su encabezado y botón principal.
- `apps/api/src/config/env.test.ts`: configuración válida, obligatoria ausente y valores inválidos.
- `apps/api/src/errors/app-error.test.ts`: jerarquía, códigos y sanitización de errores desconocidos.
- `apps/api/src/services/health.service.test.ts`: PostgreSQL disponible y no disponible.
- `apps/api/src/app.test.ts`: health 200/503, request ID, 404 y contrato de error sanitizado.
- `apps/api/src/repositories/normalize-email.test.ts`: normalización determinista de email.
- `apps/api/src/database/test-database.test.ts`: safeguards para impedir limpieza fuera de una base `_test` separada.

La cobertura de negocio sigue pendiente porque todavía no existen funcionalidades de negocio.

## Ejecución

`npm run test` ejecuta unitarios e integración HTTP sin watch. `npm run test:watch` es solo para desarrollo. La configuración de Vitest aporta variables sintéticas; ninguna prueba conecta accidentalmente a una base real.

## Estrategia de base de datos

Los unitarios inyectan un `DatabaseProbe` controlado y Supertest usa la aplicación sin puerto. La suite normal no necesita PostgreSQL.

La suite `npm run test:db` usa PostgreSQL real, aplica migrations y valida tablas, inserts, unicidad de email, animales, publicaciones, FKs, coordenadas, imágenes y `findById`. No usa SQLite ni mocks como sustituto. Requiere `NODE_ENV=test`, `DATABASE_TEST_URL` distinta de desarrollo y nombre terminado en `_test`; limpia filas con `DELETE` en orden seguro, nunca `DROP`/`TRUNCATE`.

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
