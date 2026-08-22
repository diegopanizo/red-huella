# AGENTS.md — Guía de desarrollo de Red Huella

Estado: Milestone 4 implementado; el siguiente alcance autorizado es Milestone 5. La autenticación vigente usa sesiones opacas PostgreSQL y cookies HttpOnly.

Este archivo contiene reglas obligatorias para cualquier persona o agente que modifique el repositorio. Antes de cambiar código, se debe inspeccionar el estado real y respetar el alcance del milestone activo.

## Arquitectura

- Frontend: `UI → hooks/application → services → API`.
- Backend: `Route → Controller → Service/Use Case → Repository → Database`.
- Los componentes React presentan y coordinan interacción; no contienen reglas complejas de negocio.
- Los controllers traducen HTTP y delegan. No contienen queries ni reglas complejas.
- Los services/use cases contienen coordinación, autorización contextual y reglas de aplicación.
- Los repositories encapsulan persistencia y queries parametrizadas.
- Las dependencias apuntan hacia contratos del dominio/aplicación. Servicios externos deben quedar detrás de interfaces cuando el desacoplamiento aporte valor.
- No se realizarán cambios arquitectónicos relevantes sin registrar contexto, decisión y consecuencias en `docs/DECISIONS.md`.

## TypeScript

- Todo código nuevo debe compilar con `strict: true`.
- Evitar `any`, `@ts-ignore`, aserciones no seguras y `!`. Una excepción debe ser mínima, explicada y cubierta por validación o tests.
- Los datos externos son `unknown` hasta validarse en el límite del sistema.
- Separar tipos de transporte, dominio y persistencia cuando difieran.
- No duplicar contratos compartidos: cuando exista una necesidad real, ubicarlos en `packages/shared` sin acoplar el frontend al backend.

## Seguridad y privacidad

Nunca:

- hardcodear secretos o credenciales;
- registrar contraseñas, tokens, cookies, cabeceras de autorización o datos personales innecesarios;
- confiar en controles exclusivos del frontend;
- omitir validación de entradas o autorización por recurso;
- construir SQL concatenando datos externos;
- exponer coordenadas exactas como ubicación pública por defecto;
- afirmar que un control está implementado sin evidencia en el repositorio.

Aplicar mínimo privilegio, defensa en profundidad, Secure by Design y Privacy by Design. Toda entrada debe validarse en servidor. Consultar `SECURITY.md` y `docs/PRIVACY.md` antes de trabajar con identidad, uploads, ubicación o logs.

## Persistencia y backend

- Usar exclusivamente el cliente/pool central de `apps/api/src/database/client.ts`; nunca abrir conexiones por request.
- Ejecutar queries mediante Drizzle/repositories y migrations versionadas; nunca modificar producción manualmente.
- No ejecutar `db:migrate` contra una URL no verificada ni registrar `DATABASE_URL`.
- No usar `db push` como sustituto de migrations versionadas.
- Antes de limpiar datos de tests, exigir `NODE_ENV=test`, URL separada y base terminada en `_test`.
- Todo acceso a variables de entorno pasa por `config/env.ts`.
- Propagar `requestId` y usar el logger estructurado; no registrar bodies, cookies, tokens ni cabeceras sensibles.

## Calidad del código

- Aplicar KISS, DRY y SOLID cuando reduzcan complejidad real.
- Mantener módulos pequeños y responsabilidades claras; evitar God Components y God Services.
- Manejar errores de forma explícita y no revelar detalles internos al cliente.
- Evitar dependencias nuevas salvo necesidad comprobada, compatibilidad revisada y justificación documentada.
- Preservar cambios ajenos y no reescribir partes funcionales sin necesidad.

## Testing

- Cada feature debe incorporar tests proporcionales a su riesgo cuando se implemente.
- Frontend: Vitest y React Testing Library; probar comportamiento observable y accesibilidad.
- Backend: Vitest y Supertest; probar reglas, validación, autorización y contratos HTTP.
- E2E posterior: Playwright para recorridos críticos.
- No crear tests triviales o ficticios para aumentar métricas.
- Un fallo no se silencia ni se convierte en éxito artificialmente.

## Documentación

- Mantener los `.md` alineados con el estado real.
- Usar `implementado`, `planificado` y `pendiente` con precisión.
- Actualizar requisitos, API, arquitectura, decisiones, seguridad, privacidad, testing y changelog cuando el cambio los afecte.
- No crear `docs/SLIDES.md` ni `docs/VIDEO.md` hasta la fase final del TFM.

## Definition of Done

Antes de considerar terminada cualquier tarea relevante, ejecutar desde la raíz:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Una feature futura no estará terminada hasta cumplir:

- [ ] implementación
- [ ] tipado
- [ ] validación
- [ ] seguridad y privacidad revisadas
- [ ] manejo de errores
- [ ] tests relevantes
- [ ] lint
- [ ] format:check
- [ ] typecheck
- [ ] build
- [ ] documentación

Si un control no aplica, se documentará el motivo; no se marcará implícitamente como cumplido.
