# Registro de decisiones arquitectónicas

## ADR-019 — Ownership, transacciones y retirada de publicaciones

**Status:** Accepted

**Context:** Las mutaciones deben impedir acceso cruzado y los cambios publication/animal no pueden quedar parciales.

**Decision:** Derivar owner solo de la sesión, responder 404 si no existe y 403 si existe pero pertenece a otro usuario, y ejecutar create/update compuesto en transacciones Drizzle. El borrado es archivado lógico mediante el endpoint de estado; no se expone DELETE físico. `ARCHIVED` se oculta públicamente y queda visible en `/mine`. `updated_at` se gestiona desde aplicación.

**Consequences:** La política es explícita y testeable, conserva historial y evita huérfanos. Una futura moderación administrativa necesitará autorización separada. Las lecturas aún devuelven ubicación provisional exacta hasta el milestone geoespacial.

## ADR-018 — Sesiones opacas y seguridad de credenciales

**Status:** Accepted

**Context:** La aplicación web necesita sesiones revocables sin introducir Redis ni complejidad de revocación JWT.

**Decision:** Usar un token aleatorio de 256 bits en cookie HttpOnly SameSite Strict, persistir solo SHA-256 en PostgreSQL y expirar a siete días. Secure se activa en producción; `Path=/api/v1` permite autenticar todas las rutas de la API manteniendo menor alcance que `/`. Los POST validan Origin exacto. Las contraseñas usan Argon2id con 19 MiB, coste temporal 2, paralelismo 1 y salida de 32 bytes; `needsRehash` permite elevar parámetros. El registro crea sesión automáticamente.

**Alternatives:** JWT, sesiones en Redis, cookies firmadas y token CSRF independiente.

**Consequences:** Logout y bloqueo tienen efecto consultando estado persistido. SameSite más Origin ofrecen defensa CSRF proporcional a la arquitectura same-site; si se habilitan orígenes cross-site habrá que rediseñarla. SHA-256 es adecuado para tokens aleatorios de alta entropía, no para contraseñas. El rate limiter en memoria no coordina múltiples instancias.

Los ADR son simplificados. Un cambio posterior conservará la decisión anterior y añadirá un nuevo ADR que la sustituya.

## ADR-001 — React + Vite para frontend

**Status:** Accepted

**Context:** Se necesita una SPA moderna, rápida de desarrollar y adecuada para demostrar arquitectura frontend. El frontend ya fue inicializado con este stack.

**Decision:** Usar React con Vite y organizar el código por funcionalidades.

**Alternatives:** Next.js, Angular, Vue; no aportan una ventaja necesaria para el alcance actual y supondrían reescritura.

**Consequences:** Desarrollo y build sencillos; routing, estrategia de datos y renderizado se decidirán explícitamente cuando haya requisitos.

## ADR-002 — TypeScript estricto

**Status:** Accepted

**Context:** Los contratos cruzan UI, HTTP y persistencia, y el TFM debe ser mantenible.

**Decision:** Usar TypeScript con `strict: true` y validar datos externos en runtime.

**Alternatives:** JavaScript o TypeScript no estricto.

**Consequences:** Más seguridad de refactor y errores tempranos; requiere disciplina y schemas. Web y API declaran modo estricto, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.

## ADR-003 — Node.js + Express para API

**Status:** Accepted

**Context:** El stack está definido y permite compartir lenguaje y conocimientos con el frontend.

**Decision:** Construir la API con Node.js, Express y TypeScript.

**Alternatives:** Fastify, NestJS u otro lenguaje.

**Consequences:** Ecosistema amplio y control de arquitectura; el equipo debe definir explícitamente validación, errores, seguridad y composición.

## ADR-004 — PostgreSQL como fuente de verdad

**Status:** Accepted

**Context:** El dominio tiene relaciones, integridad transaccional y búsquedas geográficas futuras.

**Decision:** Usar PostgreSQL, incorporando PostGIS cuando se implemente geolocalización.

**Alternatives:** Bases documentales o servicios propietarios.

**Consequences:** Buenas constraints y capacidades espaciales; exige migraciones y operación. pgvector queda condicionado al Milestone 14.

## ADR-005 — Monorepo

**Status:** Accepted

**Context:** Web, API, documentación y contratos pertenecen al mismo producto y evolucionan coordinadamente.

**Decision:** Mantener `apps`, `packages`, `database`, `docs` y automatización en un repositorio.

**Alternatives:** Repositorios separados.

**Consequences:** Cambios atómicos y CI común; npm workspaces coordina `apps/*` y futuros `packages/*` mediante un único lockfile.

## ADR-006 — API REST versionada

**Status:** Accepted

**Context:** La SPA necesita una interfaz de red simple, observable y ampliamente soportada.

**Decision:** Exponer recursos JSON bajo `/api/v1` mediante REST.

**Alternatives:** GraphQL, RPC o acceso directo a datos.

**Consequences:** Contratos y semántica HTTP claros; se deben diseñar paginación, errores, compatibilidad y autorización por endpoint.

## ADR-007 — Arquitectura por capas y módulos

**Status:** Accepted

**Context:** Se debe impedir que HTTP, reglas y SQL queden acoplados y facilitar tests.

**Decision:** Backend `Route → Controller → Service/Use Case → Repository`; frontend `UI → hooks/application → services → API`, agrupados por feature/módulo.

**Alternatives:** Controllers con acceso directo a datos, organización solo por tipo técnico o arquitectura hexagonal completa desde el inicio.

**Consequences:** Responsabilidades testeables y sustitución de infraestructura; añade contratos, pero se evitarán abstracciones prematuras.

## ADR-008 — npm workspaces

**Status:** Accepted

**Context:** Web y API necesitan instalación reproducible y comandos coordinados sin incorporar otro gestor.

**Decision:** Usar npm workspaces para `apps/*` y `packages/*`, con un único `package-lock.json` raíz.

**Alternatives:** pnpm, Yarn o instalaciones independientes.

**Consequences:** Menos tooling y dependencias duplicadas; los scripts raíz coordinan workspaces y npm 11 pasa a ser requisito.

## ADR-009 — Node.js 24 LTS

**Status:** Accepted

**Context:** El entorno usa Node 24 y las versiones actuales de Vite y testing requieren una versión moderna compatible.

**Decision:** Soportar Node `>=24 <25` y npm `>=11 <12`, reflejado en `.nvmrc`, `engines` y CI.

**Alternatives:** Mantener un rango amplio sin verificar o seleccionar una versión anterior.

**Consequences:** Entornos reproducibles y compatibles con el toolchain; una actualización mayor requerirá verificación y ADR sustitutorio.

## ADR-010 — Vitest como runner base

**Status:** Accepted

**Context:** Frontend y API requieren tests rápidos en TypeScript con integración natural con Vite.

**Decision:** Usar Vitest en ambos workspaces, React Testing Library/jsdom en web y Supertest en API.

**Alternatives:** Jest o runners diferentes por aplicación.

**Consequences:** Configuración homogénea; Playwright permanece fuera de alcance hasta el Milestone 12.

## ADR-011 — Prettier común

**Status:** Accepted

**Context:** El monorepo necesita formato determinista independiente de las reglas de calidad de ESLint.

**Decision:** Usar una configuración Prettier raíz y scripts separados `format` y `format:check`.

**Alternatives:** Formato manual o reglas de formato dentro de ESLint.

**Consequences:** Diffs consistentes y comprobación en CI; Prettier no sustituye lint ni typecheck.

## ADR-012 — Coordinación local multiplataforma

**Status:** Accepted

**Context:** `npm run dev` debe iniciar y detener web y API. Los procesos npm anidados no propagaron correctamente señales a sus descendientes en Windows.

**Decision:** Usar `concurrently` únicamente para coordinar los dos scripts de desarrollo.

**Alternatives:** Un script artesanal con `child_process`, terminales separadas o no ofrecer desarrollo coordinado.

**Consequences:** Se añade una dependencia de desarrollo acotada, a cambio de cierre fiable y comportamiento consistente entre sistemas operativos. Los comandos individuales siguen disponibles.

## ADR-013 — PostgreSQL, Drizzle ORM y driver pg

**Status:** Accepted

**Context:** El dominio futuro necesita integridad relacional, migrations explícitas y evolución hacia PostGIS/pgvector sin ocultar SQL. Node requiere un driver apto para conexiones persistentes.

**Decision:** Usar PostgreSQL como fuente de verdad, Drizzle ORM/Kit para schema, queries y migrations, y exclusivamente `pg` con un pool central como driver.

**Alternatives:** Prisma, Sequelize, TypeORM, drivers serverless o SQL manual sin toolkit.

**Consequences:** Buen tipado y control del SQL con menor abstracción; el equipo debe revisar migrations y operar PostgreSQL. No se crean tablas hasta el diseño de dominio del Milestone 3. PostGIS y pgvector siguen aplazados.

## ADR-014 — Logging estructurado con Pino

**Status:** Accepted

**Context:** La API necesita correlacionar requests y errores sin registrar cuerpos ni secretos, con bajo coste operativo.

**Decision:** Usar Pino, UUID interno por request y logs de finalización con método, path, estado y duración. Los health checks exitosos se omiten para evitar ruido; los fallidos sí se registran.

**Alternatives:** `console`, Winston o logging HTTP automático con cabeceras completas.

**Consequences:** Logs JSON procesables y redacción central; producción deberá definir transporte, retención y acceso. El request ID entrante no se reutiliza para evitar validación/confianza prematura.

## ADR-015 — Identidad e invariantes del modelo inicial

**Status:** Accepted

**Context:** El modelo necesita IDs no secuenciales, valores controlados, email consistente y fechas inequívocas antes de implementar autenticación.

**Decision:** Usar UUID v4 generados por PostgreSQL, enums nativos para conjuntos cerrados, email normalizado a lowercase por repository y reforzado con `CHECK` más índice único, y `timestamptz` interpretado en UTC. `password_hash` se aplaza al Milestone 4 para introducirlo junto a sus invariantes de seguridad.

**Alternatives:** IDs secuenciales, enums libres en texto, `citext`, índice funcional sobre email, timestamps sin zona e incluir un password nullable sin flujo.

**Consequences:** La base protege invariantes y no requiere extensiones; añadir valores enum exige migration. Todo acceso que cree usuarios debe reutilizar la normalización. La UI futura convierte UTC a zona local.

## ADR-016 — Contratos repository sobre Drizzle

**Status:** Accepted

**Context:** Los services futuros no deben conocer queries o tipos operativos del driver, pero una arquitectura ceremonial sería prematura.

**Decision:** Definir contratos pequeños `UserRepository`, `AnimalRepository` y `PublicationRepository`, con implementaciones Drizzle que solo ofrecen `create` y `findById` y convierten errores técnicos en `DatabaseError`.

**Alternatives:** Inyectar Drizzle directamente en services o crear capas genéricas CRUD.

**Consequences:** Los services podrán probarse contra contratos y la persistencia conserva queries explícitas. Cada método nuevo deberá responder a un caso de uso real.

## ADR-017 — PostgreSQL 17 local y Compose opcional

**Status:** Accepted

**Context:** El proyecto debe funcionar con PostgreSQL instalado en Windows y ofrecer un entorno reproducible sin dockerizar aplicaciones.

**Decision:** Soportar PostgreSQL 17 mediante `DATABASE_URL` y proporcionar `compose.yml` únicamente para PostgreSQL, con volumen, healthcheck y una base de test separada.

**Alternatives:** Exigir instalación local, dockerizar todo el monorepo o usar una base embebida.

**Consequences:** La aplicación no conoce Docker y puede apuntar a local/cloud. Docker es opcional, publica `5434:5432` para no colisionar con PostgreSQL Windows en 5432/5433 y sus credenciales son solo de desarrollo. La instalación PostgreSQL 9.5 detectada no es la versión objetivo.
