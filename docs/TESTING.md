# Estrategia de testing

## Estado

**Base implementada.** Vitest se ejecuta por workspace desde la raíz. El frontend usa React Testing Library con jsdom y la API usa Supertest sin abrir un puerto real.

Tests actuales:

- `apps/web/src/App.test.tsx`: comprueba que la interfaz inicial renderiza su encabezado y botón principal.
- `apps/api/src/app.test.ts`: comprueba `GET /api/v1/health`, HTTP 200 y `{ "status": "ok" }`.

La cobertura de negocio sigue pendiente porque todavía no existen funcionalidades de negocio.

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

## Calidad y CI futuras

Cada corrección incorporará una regresión cuando sea viable. No se perseguirá cobertura como objetivo aislado; se fijarán umbrales razonados cuando exista una línea base. La CI ejecutará lint, typecheck, tests y build, y publicará evidencia sin secretos. Los E2E podrán ejecutarse en una etapa separada por su coste.

## Datos de prueba

Solo datos sintéticos y fábricas deterministas. Las imágenes de prueba deben tener licencia compatible y metadatos controlados. Cada suite limpiará su estado sin apuntar a producción.
