# Estrategia de deployment

**Estado: Pendiente.** No hay infraestructura ni entorno desplegado. Existe CI y un Compose opcional exclusivamente para un PostgreSQL 17 local reproducible; no es una arquitectura de producción. Las plataformas se elegirán cuando existan requisitos operativos medibles.

La aplicación depende únicamente de `DATABASE_URL`: PostgreSQL puede proceder de una instalación Windows local, Docker o un servicio cloud sin cambios en el código. Compose publica exclusivamente `127.0.0.1:5434:5432` para no colisionar con las instalaciones locales en 5432 y 5433. Sus credenciales `red_huella_app`/`red_huella_dev_only` son development-only y nunca deben reutilizarse en producción.

## PostGIS para Milestone 8

Compose usa `postgis/postgis:17-3.5`, variante Debian estable para PostgreSQL 17, y conserva `/var/lib/postgresql/data`. Cambiar desde `postgres:17-alpine` no borra ni recrea automáticamente el volumen. Tampoco garantiza que scripts de `/docker-entrypoint-initdb.d` ni la inicialización de PostGIS se ejecuten sobre un volumen existente: estos mecanismos solo actúan al inicializar un directorio vacío. Se debe hacer backup, levantar el contenedor de forma controlada, ejecutar el preflight y habilitar la extensión mediante la futura migración; nunca eliminar el volumen como automatismo.

### PostgreSQL 17 local en Windows

El objetivo local es exclusivamente PostgreSQL 17 en el puerto 5433. PostgreSQL 9.5 en 5432 es legado y no debe seleccionarse, actualizarse, detenerse ni recibir extensiones.

1. Hacer backup de `red_huella` y `red_huella_test`.
2. Identificar el servicio, directorio y StackBuilder asociados a PostgreSQL 17.
3. Conectarse a 5433 y confirmar `SELECT version(), current_setting('port'), current_database();` antes de instalar.
4. Abrir ese StackBuilder y seleccionar la instalación PostgreSQL 17, nunca la 9.5.
5. Instalar la versión estable de PostGIS ofrecida como compatible con PostgreSQL 17, verificando el directorio de destino.
6. Volver a ejecutar `npm run db:postgis:preflight` contra cada base prevista.
7. No ejecutar todavía `CREATE EXTENSION`: tras confirmar disponibilidad se revisará el resultado y se preparará la migración `0003`.

El preflight es solo lectura. Informa versión PostgreSQL, puerto, base, disponibilidad del paquete, instalación de la extensión y `postgis_full_version()` cuando ya exista. Usa `DATABASE_URL`, no cambia de base ni muestra credenciales.

## Topología futura

```mermaid
flowchart LR
    U[Browser] -->|HTTPS| F[Frontend estático/CDN]
    F -->|HTTPS| A[Node.js / Express API]
    A --> D[(PostgreSQL)]
    A -. futuro .-> O[Almacenamiento de imágenes]
```

## Requisitos previstos

- Frontend compilado como assets versionados y servido por HTTPS.
- API Node ejecutada como proceso no privilegiado, con health checks, límites y cierre ordenado.
- PostgreSQL gestionado o administrado con backups, cifrado, red restringida y restauración probada.
- Variables de entorno validadas al arrancar; secretos proporcionados por el entorno, nunca por Git.
- CORS con allowlist de los orígenes reales.
- Migraciones versionadas antes o durante releases mediante un proceso controlado, no automáticamente desde cada réplica.
- Logs y métricas sin datos sensibles; alertas proporcionadas al riesgo.

## Entornos futuros

Se prevén al menos local, CI/test y producción. Un staging solo se añadirá si aporta valor al flujo. Cada entorno tendrá recursos, credenciales y datos separados; producción no se usará para pruebas.

## Flujo de release previsto

1. CI ejecuta lint, typecheck, tests y build.
2. Se construye un artefacto reproducible e identificable por commit.
3. Se aplican migraciones compatibles mediante tarea controlada.
4. Se despliega y verifican health checks/smoke tests.
5. Se observa la release y se ejecuta rollback o forward fix si falla.

## Decisiones pendientes

Hosting, región, dominio, proveedor de object storage, estrategia de backups, observabilidad, presupuesto y objetivos de disponibilidad. El Compose local no determina el empaquetado ni el despliegue futuro de la aplicación.

## Almacenamiento de imágenes

Desarrollo configura `IMAGE_STORAGE_DRIVER=local` y `IMAGE_STORAGE_LOCAL_ROOT=.data/uploads`; `.data/tmp` queda reservado para temporales de procesamiento. Ambos directorios están fuera de Git y de `apps/web/public`. El proceso debe ser su único escritor, ejecutarse con permisos mínimos y disponer de espacio limitado.

El backend crea ambos directorios cuando son necesarios y limpia temporales al terminar, cerrar o fallar una petición. Producción debe montar storage persistente privado, limitar espacio/inodos y monitorizar tanto `.data/tmp` como jobs pendientes. `ProcessStorageDeletionJobsService` puede invocarse manualmente; este bloque no instala scheduler. El rate limiter de upload es in-memory y requiere un backend compartido o control equivalente antes de escalar horizontalmente.

El filesystem local solo es válido para desarrollo o un despliegue de una réplica con volumen persistente. Producción multi-réplica deberá implementar el mismo contrato sobre S3/R2 compatible, bucket privado y credenciales de mínimo privilegio. Backups/restauración deberán coordinar PostgreSQL y objetos. No se ha implementado aún ese adaptador ni deben declararse sus secretos. La entrega futura no usará caché pública immutable larga y debe respetar el archivado de publicaciones.
