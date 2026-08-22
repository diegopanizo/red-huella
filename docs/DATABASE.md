# Base de datos

## Operaciones funcionales de publicaciones

El modelo `User 1—N Publication N—1 Animal` se conserva. La migración aditiva del Milestone 7 almacena metadatos de las dos variantes de imagen y una outbox de borrado. El Bloque 3 implementa el repositorio transaccional y el upload HTTP sin alterar las migraciones aplicadas. Crear animal/publicación y editar ambos continúan siendo transacciones Drizzle.

`approximate_age` conserva la unidad definida en el modelo inicial: meses. La API limita el valor a 0–600 meses. `resolved_at` se establece para `RESOLVED`/`ADOPTED`; archivar lo mantiene null.

## Autenticación

`users.password_hash` es nullable durante la transición para conservar usuarios seed previos y cuentas de desarrollo existentes sin credenciales; todo registro público escribe un hash Argon2id. No bloquea el Milestone 4. Se revisará convertirlo a `NOT NULL` cuando todos los usuarios funcionales requieran autenticación. `sessions` contiene UUID, FK `user_id` con cascade, `token_hash` SHA-256 único, expiración, creación, último uso y revocación. El token opaco nunca se persiste.

```mermaid
erDiagram
  USERS ||--o{ SESSIONS : has
  USERS { uuid id string password_hash }
  SESSIONS { uuid id uuid user_id string token_hash timestamptz expires_at timestamptz revoked_at }
```

La autenticación comprueba expiración en cada lectura; no depende de limpieza programada. `deleteExpired` prepara una tarea futura. `last_used_at` no se actualiza por request para evitar escrituras excesivas.

## Estado

El modelo inicial está implementado mediante PostgreSQL 17, Drizzle ORM y el driver único `pg`. Existe una migration versionada, seed idempotente y repositories base. La generación del SQL está verificada; la conexión/migration sobre una instancia real no pudo verificarse por falta de credenciales locales.

## Tablas implementadas

```mermaid
erDiagram
    USERS ||--o{ PUBLICATIONS : creates
    ANIMALS ||--o{ PUBLICATIONS : appears_in
    PUBLICATIONS ||--o{ PUBLICATION_IMAGES : has

    USERS {
      uuid id PK
      varchar name
      varchar email UK
      user_role role
      user_status status
      timestamptz email_verified_at
      timestamptz created_at
      timestamptz updated_at
    }
    ANIMALS {
      uuid id PK
      varchar name
      species species
      varchar breed
      animal_sex sex
      varchar color
      animal_size size
      integer approximate_age
      text description
      timestamptz created_at
      timestamptz updated_at
    }
    PUBLICATIONS {
      uuid id PK
      uuid user_id FK
      uuid animal_id FK
      publication_type type
      varchar title
      text description
      publication_status status
      timestamptz event_date
      double latitude
      double longitude
      timestamptz created_at
      timestamptz updated_at
      timestamptz resolved_at
    }
    PUBLICATION_IMAGES {
      uuid id PK
      uuid publication_id FK
      varchar storage_key UK
      integer position
      timestamptz created_at
    }
```

`favorites`, `reports`, `shelters` y `matches` son futuros. No existen en el schema actual.

## Decisiones de modelado

### UUID

Todas las claves primarias usan UUID v4 generado por PostgreSQL mediante `gen_random_uuid()`. PostgreSQL 17 lo incorpora sin activar una extensión adicional. El seed usa UUID fijos únicamente para ser idempotente.

### Usuarios y email

`name` y `email` son obligatorios. El repository elimina espacios exteriores y convierte el email a lowercase. La base refuerza lowercase mediante `CHECK` y unicidad mediante índice único. No se usa `citext`, evitando una extensión innecesaria.

`password_hash` existe y permanece nullable por la transición del schema y los usuarios seed/desarrollo anteriores sin credenciales. El registro funcional siempre guarda Argon2id. Convertirlo a `NOT NULL` es una tarea futura cuando todas las cuentas deban autenticarse. El seed no contiene passwords ni un administrador operativo.

### Enums

Se usan enums PostgreSQL porque los conjuntos actuales son pequeños y forman invariantes estructurales:

- roles: `USER`, `SHELTER`, `ADMIN`;
- usuario: `ACTIVE`, `BLOCKED`;
- especie: `DOG`, `CAT`, `OTHER`;
- sexo: `MALE`, `FEMALE`, `UNKNOWN`;
- tamaño: `SMALL`, `MEDIUM`, `LARGE`, `UNKNOWN`;
- publicación: `LOST`, `FOUND`, `ADOPTION`;
- estado: `ACTIVE`, `RESOLVED`, `ADOPTED`, `ARCHIVED`.

Añadir valores requiere migration, lo que hace la evolución explícita.

### Animales y publicaciones

El nombre del animal es nullable porque un animal encontrado puede ser desconocido. Especie es obligatoria; raza, color, edad aproximada y descripción pueden faltar. `approximate_age` se expresa provisionalmente en meses y no puede ser negativa.

Un animal puede aparecer en varias publicaciones a lo largo del tiempo. `event_date` representa el suceso relevante y no se confunde con `created_at`.

### Ubicación

`latitude` y `longitude` son coordenadas exactas internas temporales, nunca una respuesta pública automática. Deben existir juntas y respetar `[-90, 90]` y `[-180, 180]`. En el milestone geoespacial se incorporará PostGIS y una representación pública aproximada separada; la migración deberá conservar la distinción y minimizar precisión almacenada.

### Imágenes

PostgreSQL solo almacena metadatos y keys neutrales, nunca binarios, originales ni URLs de proveedor. `storage_key` identifica `display.webp` y `thumbnail_storage_key` su thumbnail. Ambas son únicas. MIME normalizado es `image/webp`; dimensiones, bytes y SHA-256 se almacenan separadamente por variante para integridad y ETag independientes.

Las columnas añadidas son nullable para aceptar filas legacy sin metadatos. Los `CHECK` exigen que cada grupo esté completamente vacío o completamente informado, dimensiones positivas dentro de 2048/640 px, bytes positivos y checksum hexadecimal de 64 caracteres. Las nuevas escrituras deberán completar ambas variantes. `position >= 0`, `(publication_id, position)` es única y `position = 0` es la principal. El máximo de seis imágenes se impondrá en aplicación y transacción.

`storage_deletion_jobs` es exclusivamente una outbox pequeña para borrar objetos: key, intentos, próximo intento, último error sanitizado, creación y finalización. No tiene FK porque debe sobrevivir al metadato eliminado. Un índice por finalización/próximo intento soporta el consumo de pendientes. Delete elimina metadata, compacta posiciones y crea jobs para display/thumbnail dentro de una única transacción; el servicio intenta procesarlos tras commit y deja los fallidos pendientes. No existe cron ni framework genérico de workers.

## Timestamps

Todos los timestamps usan `timestamptz` y se interpretan en UTC. La futura UI convertirá a zona local. `updated_at` se actualizará explícitamente en repositories/casos de uso; no se oculta en triggers en esta fase.

## Foreign keys y borrado

- `publications.user_id → users.id`: `RESTRICT`; una eliminación de cuenta no destruye silenciosamente historial y debe pasar por una política de privacidad/moderación.
- `publications.animal_id → animals.id`: `RESTRICT`; evita eliminar un animal referenciado.
- `publication_images.publication_id → publications.id`: `CASCADE`; una imagen es un registro subordinado sin significado independiente.

No se aplica soft delete genérico. Usuarios y publicaciones ya tienen estados para bloqueo/archivo; el borrado y anonimización se diseñarán por requisito, no mediante una columna universal.

## Índices

- único `users.email`;
- `publications.user_id` y `publications.animal_id` para joins/FK;
- `publications.type`, `status`, `event_date` y `created_at` para filtros/orden previstos;
- único `(publication_images.publication_id, position)`, que también cubre búsquedas por publicación;
- único `publication_images.storage_key`.

No se añaden índices combinados sin queries y mediciones reales.

## Migrations

Las migrations aplicadas no se modifican. `0002_abandoned_raider.sql` añade los metadatos de imagen y `storage_deletion_jobs`. Flujo:

```bash
npm run db:generate
npm run db:migrate
```

Se revisa el SQL generado y no se usa `db push` como flujo principal.

## Seed

`npm run db:seed` inserta mediante `ON CONFLICT DO NOTHING` dos usuarios `USER` sin contraseña, tres animales y tres publicaciones. No crea imágenes ficticias ni incluye binarios demo. Es explícito, repetible y está bloqueado si `NODE_ENV=production`.

## Desarrollo y tests

La aplicación consume exclusivamente `DATABASE_URL`, ya apunte a Windows, Docker o cloud. Compose ofrece PostgreSQL 17 como entorno local reproducible opcional en `localhost:5434` (`5432` interno); sus credenciales son development-only. `DATABASE_TEST_URL` debe ser distinta, terminar en `_test` y ejecutarse con `NODE_ENV=test`; los tests eliminan filas en orden de dependencias, pero nunca ejecutan `DROP` o `TRUNCATE`.

## Evolución futura

- PostGIS y ubicación pública aproximada: Milestone 8 tras el cambio de orden registrado en ADR-021.
- `favorites`, `reports`, `shelters` y `matches`: milestones posteriores.
- pgvector y embeddings: Milestone 14, condicionado a evaluación técnica y de privacidad.
