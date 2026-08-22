# Contribuir a Red Huella

## Estado

El proyecto está en desarrollo. Antes de contribuir, consulta `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md` y el milestone activo en `docs/ROADMAP.md`.

## Preparación actual

El repositorio usa npm workspaces. Instala todo desde la raíz:

```bash
npm install
```

Inicia las aplicaciones con `npm run dev:web`, `npm run dev:api` o ambas con `npm run dev`. No se deben documentar o simular flujos de negocio inexistentes.

## Branches

- Crear ramas breves desde la rama principal actualizada.
- Usar nombres descriptivos, por ejemplo `feat/publications-search` o `docs/security-model`.
- Evitar mezclar refactors amplios con una feature.

## Commits

Usar Conventional Commits:

- `feat:` funcionalidad
- `fix:` corrección
- `docs:` documentación
- `test:` pruebas
- `refactor:` cambio interno sin alterar comportamiento
- `chore:` mantenimiento
- `ci:` integración continua
- `security:` endurecimiento o corrección de seguridad

Cada commit debe ser coherente, revisable y no incluir secretos, artefactos de build ni configuración local.

## Pull requests

La descripción debe indicar problema, solución, alcance, riesgos, verificaciones y documentación afectada. Los cambios de arquitectura requieren actualizar `docs/DECISIONS.md`. Los cambios visuales futuros incluirán evidencia apropiada sin datos personales.

## Comprobaciones

Antes de proponer un cambio relevante, ejecutar desde la raíz:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Los tests actuales cubren la interfaz inicial y el health endpoint. Cada cambio deberá añadir cobertura relacionada con el comportamiento que introduzca.

## Documentación y seguridad

Actualizar la documentación en el mismo cambio. Revisar `SECURITY.md` y `docs/PRIVACY.md` para identidad, autorización, ubicación, imágenes, logs o datos personales. Toda nueva dependencia necesita una necesidad concreta, revisión de compatibilidad y justificación.
