# Architecture Decision Records (ADR)

Captura las decisiones arquitecturales y de infra del proyecto Qavante. Cada ADR documenta **una sola decisión** — qué se decidió, por qué, y qué se descartó.

## Por qué existen

Tres problemas que los ADRs atajan:

1. **Reconstruir el porqué cuesta arqueología.** "¿Por qué Workers y no Pages?" → 3 PRs viejos + un párrafo perdido en CLAUDE.md. Con un ADR son 30 líneas en un archivo con fecha.
2. **Las decisiones implícitas se diluyen.** El `https://qavante.com` apareció hardcoded en un workflow antes de existir en cualquier doc. Un ADR fuerza a escribir la decisión cuando se toma, no después.
3. **Cross-repo coordination.** Cuando hay que coordinar con CC-API o futuras integraciones, un ADR es la URL que se pega en el issue cross-repo. Una sola fuente de verdad.

## Cuándo escribir uno

Sí ADR:

- Elección entre alternativas con tradeoffs reales (Workers vs Pages, dominio `.com` vs `.cl`, cookie design).
- Decisiones que afectan más de un repo o sistema externo.
- Cambios en stack o convenciones que un dev nuevo necesitaría conocer.

No ADR:

- Bug fixes, refactors locales, cambios cosméticos.
- Decisiones reversibles en < 1h de trabajo (renombrar una variable, mover un archivo).
- Pasos operativos (esos van a `docs/operations/`).

## Cómo escribir uno

Copiá [template.md](./template.md), numerá `NNNN-titulo-kebab.md` (siguiente disponible), llenalo. Status arranca en `Proposed`. Cuando el cambio se mergea a main pasa a `Accepted`. Si se revierte o reemplaza, pasa a `Superseded by ADR-NNNN`.

PR del ADR puede ir solo (decisión sin código) o acoplado al PR del cambio que lo materializa — la convención del repo es acoplar cuando el cambio cabe en un PR razonable.

## Índice

| #                                                            | Título                                                                | Status                | Fecha      |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------- | ---------- |
| [0001](./0001-cloudflare-workers-vs-pages.md)                | Cloudflare Workers vía `@opennextjs/cloudflare` (no Pages)            | Accepted              | 2026-05-08 |
| [0002](./0002-dominio-oficial-qavante-com.md)                | Dominio oficial `qavante.com` (no `qavante.cl`)                       | Accepted              | 2026-05-12 |
| [0003](./0003-api-qavante-com-shared-parent.md)              | Backend en `api.qavante.com` para shared parent con FE                | Accepted              | 2026-05-12 |
| [0004](./0004-asistente-qavante-anti-patterns.md)            | Asistente Qavante — anti-patterns de exposición y políticas mínimas   | Accepted (preventiva) | 2026-05-12 |
| [0005](./0005-mock-service-worker-for-fe-dev.md)             | Mock Service Worker (MSW) para desarrollo y testing de FE sin backend | Accepted              | 2026-05-13 |
| [0006](./0006-sii-credentials-storage-decisions.md)          | SII credentials — decisiones de almacenamiento (placeholder)          | Deferred              | 2026-05-13 |
| [0007](./0007-estructura-carpetas-dominios-addendum.md)      | Mantener `src/components/` + `src/lib/api/` (no `src/features/`)      | Proposed              | 2026-05-15 |
| [0008](./0008-feature-flags-gating-pantallas-sin-backend.md) | Feature flags para gating de pantallas del addendum sin mocks         | Proposed              | 2026-05-15 |
| [0009](./0009-politica-drag-and-drop.md)                     | Política de drag-and-drop para árboles de gestión (preventiva)        | Proposed              | 2026-05-15 |
| [0010](./0010-selectores-sin-libreria-combobox.md)           | Selectores de clasificación sin librería combobox (dependency-free)   | Proposed              | 2026-05-16 |
