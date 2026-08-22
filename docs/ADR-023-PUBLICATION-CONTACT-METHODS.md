# ADR-023 — Métodos de contacto por publicación

## Estado

Aceptada e implementada. Milestone 9 completado.

## Contexto

Red Huella necesita permitir contacto con quien creó una publicación sin convertir el email de acceso ni un perfil global en datos públicos. Cada publicación puede requerir métodos distintos y un cambio posterior de perfil no debe alterar snapshots históricos de forma inesperada.

Teléfonos y emails son datos personales. Incluirlos en el aggregate público, listados, cards o búsquedas facilitaría exposición accidental, scraping y caché no controlada. Una futura mensajería interna tendrá reglas de participantes, contenido y retención diferentes.

## Decisión

- Persistir un snapshot independiente por publicación en `publication_contact_methods`.
- Admitir exactamente `WHATSAPP`, `PHONE` y `EMAIL`; ausencia de fila significa método deshabilitado.
- No añadir `user_id` ni `enabled`: ownership se deriva de `publications.user_id`.
- No copiar automáticamente `users.email`, teléfono a WhatsApp ni valores entre publicaciones.
- Reemplazar la colección completa de forma transaccional; una colección vacía elimina físicamente todos los métodos.
- Mantener contactos fuera de `PublicPublicationDto`, `/manage`, listados, cards y búsqueda geográfica. Las consultas públicas no unirán esta tabla.
- Revelar contacto solo mediante endpoint específico y acción explícita, con sesión válida, autor activo, publicación `ACTIVE`, rate limiting y `Cache-Control: private, no-store`.
- `RESOLVED`, `ADOPTED` y `ARCHIVED` no serán contactables públicamente. El owner podrá leer y retirar sus datos en cualquier estado.
- Guardar inicialmente el valor canónico en texto normal. No se indexa por valor ni se registra en logs.
- Mantener mensajería interna fuera de este milestone y de este modelo.

## Modelo y validación

La tabla contiene UUID, FK a publicación con cascade, tipo, valor y timestamps. `(publication_id, method)` es único. La base exige valor no vacío y sin espacios exteriores, limita email a 254 caracteres y exige E.164 para teléfono/WhatsApp. La aplicación valida sintaxis, normaliza email con `trim` y lowercase, limita la colección a tres tipos no repetidos y no infiere prefijos de país.

El orden de lectura contractual es `WHATSAPP`, `PHONE`, `EMAIL`, independiente del orden de inserción.

## Alternativas descartadas

- Campos nullable en `publications`: mezclan PII con el aggregate más consultado.
- Perfil global con flags: un cambio global podría modificar publicaciones históricas sin intención.
- Reutilizar el email de login: contradice consentimiento y separación de finalidades.
- Hash irreversible: no permite revelar el dato autorizado.

## Consecuencias y riesgos

El modelo minimiza joins accidentales y permite configuraciones distintas y retirada física. Sin embargo, una filtración de PostgreSQL o backups expondría los valores porque aún no existe KMS ni gestión de claves de campo.

Antes de producción real se revisarán permisos, cifrado de backups y envelope encryption desde aplicación con claves externas, rotación y versión de clave. Añadir una clave simétrica junto a la aplicación no se considerará una mitigación suficiente.

La implementación resultante incluye endpoints owner separados, revelación pública autenticada bajo demanda, autorización por recurso, rate limiting, headers privados y frontend con caché efímera. El rate limiter permanece en memoria por proceso y deberá distribuirse para despliegues multiinstancia. Los valores continúan temporalmente en texto plano; antes de producción real se requieren permisos mínimos, cifrado de backups y evaluación de envelope encryption/KMS.
