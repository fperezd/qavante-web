# Reconciliación — Addendum Frontend v2.0 vs realidad del repo

> **Autor:** CC-WEB (rol CTO) — 2026-05-15
> **Propósito:** El [addendum frontend v2.0](./frontend-v2.md) es una excelente
> especificación de producto/UX, pero su redacción asume un estado y unas
> convenciones que **no coinciden con `qavante-web` real ni con CLAUDE.md**.
> Este documento resuelve cada conflicto con autoridad, para que ningún agente
> (CC-WEB, futuros) siga el addendum literalmente donde contradice al repo.
>
> **Regla de resolución** — la define el propio addendum:
>
> - §4, prioridad 1: _"Si el repo real contradice esta especificación,
>   detenerse y documentar brecha. No improvisar."_
> - §30, stop condition: _"OpenAPI expone endpoints con nombres o shapes
>   distintos a esta especificación → detenerse y pedir decisión humana."_
>
> Jerarquía de fuente de verdad operativa:
> **CLAUDE.md > ADRs > Documento Maestro v2.6.4 > este addendum.**

---

## P0 — Supuesto de estado FALSO (bloqueante)

**Addendum (Tabla 2):** _"Backend C1 desarrollado 100%; C2 implementado"_ y
_"Próximo PR #83 = integración FE post-handoff"_.

**Realidad verificada (2026-05-15, `curl https://tooxs-gestion-api.fly.dev/openapi.json`):**
el backend de producción expone **59 paths**, y **cero** de los que el addendum
requiere:

| Familia de endpoints (addendum §10)                    | Paths en prod   |
| ------------------------------------------------------ | --------------- |
| `canonical-categories`                                 | **0 — ausente** |
| `management/accounts`, `management/dimensions`         | **0 — ausente** |
| `industry-templates`                                   | **0 — ausente** |
| `core/currencies`, `exchange-rates`                    | **0 — ausente** |
| `classification-rules`                                 | **0 — ausente** |
| `credentials/sii` (handoff #71, _anterior_ en la cola) | **0 — ausente** |

Además existe `/api/bank-movements/{id}/classify` (sin prefijo `treasury`) —
ver P1-4.

**Resolución:** **PR #83 NO puede arrancar.** Está bloqueado por el handoff
backend, igual que lo estaba el handoff de credenciales SII (#71). El addendum
no destraba nada por sí solo; es la _especificación FE objetivo_ para cuando el
backend exponga estos contratos. Orden correcto de la cola:

1. Handoff **#71** (credenciales SII) — prerequisito real de Sprint C1, ya tiene
   runbook ([`../backend-contracts/c1-sii-handoff-runbook.md`](../backend-contracts/c1-sii-handoff-runbook.md)).
2. **Segundo handoff** (taxonomía / management / dimensions / currencies /
   classification) — el addendum define el lado FE esperado; el backend todavía
   no lo especificó ni implementó. Necesita su propio brief a CC-API
   (ver [`taxonomy-handoff-brief.md`](./taxonomy-handoff-brief.md)).
3. Recién entonces, los PRs #83→#89 del addendum.

---

## P1 — Contradicciones con reglas duras (resueltas)

### P1-1 · Edge Runtime

|                   |                                                                                                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Addendum dice** | Tabla 4 / §9: _"Mantener Edge Runtime en pages/routes/middleware"_, _"Todas las páginas nuevas deben declarar runtime edge si el estándar del repo lo exige"_.                                                                                                                                           |
| **Realidad**      | CLAUDE.md **regla 4**: NO declarar `export const runtime`. El default (Node) es el correcto; `@opennextjs/cloudflare` empaqueta a `workerd` con `nodejs_compat`. Declarar `runtime='edge'` **rompe el build**. Verificado: **0 ocurrencias** de `export const runtime` en `src/`.                        |
| **Resolución**    | ✅ **Gana CLAUDE.md.** Las páginas nuevas del addendum (`estructura-gestion`, `vistas-gestion`, `monedas`, `reglas-clasificacion`, `por-clasificar`) **NO declaran runtime**. La cláusula condicional del addendum ("si el estándar del repo lo exige") se cumple negativamente: el estándar lo prohíbe. |

### P1-2 · Cloudflare Pages vs Workers

|                   |                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Addendum dice** | Tablas 1 y 2: _"Cloudflare Pages"_.                                                                                                                                                                                          |
| **Realidad**      | El repo deploya a **Cloudflare Workers** vía `@opennextjs/cloudflare` (CLAUDE.md regla 4, `wrangler.toml` con `main = .open-next/worker.js`). ADR-0001 documenta la decisión Workers-sobre-Pages.                            |
| **Resolución**    | ✅ **Gana la realidad.** Es drift de nomenclatura, no de arquitectura: donde el addendum dice "Pages" léase "Workers vía @opennextjs/cloudflare". Sin impacto en el código; sí en no introducir asunciones de runtime Pages. |

### P1-3 · Estructura `src/features/`

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Addendum dice** | §24: estructura objetivo `src/features/management-accounts/...`, `src/features/currencies/...`, etc.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Realidad**      | Repo real: `src/{app,components,hooks,lib,stores,test,types}`. **`src/features/` no existe.** Convención vigente: componentes de dominio en `src/components/<dominio>/` (ej. `src/components/credenciales/`, `src/components/administracion/`), hooks+tipos+cliente de datos en `src/lib/api/<dominio>.ts`, hooks UI en `src/hooks/`. El Anexo E del Documento Maestro define la estructura canónica de carpetas.                                                                                                         |
| **Resolución**    | ✅ **Gana la estructura real + Anexo E.** El addendum mismo (§24) admite: _"Claude Code debe adaptar nombres exactos al repo real"_. Mapeo autoritativo: `src/features/<dominio>/api.ts` + `hooks.ts` → **`src/lib/api/<dominio>.ts`** (patrón ya usado por `credentials.ts`, `users.ts`); `src/features/<dominio>/components/*` → **`src/components/<dominio>/*`**. El detalle fino (¿se introduce `src/features/` como nueva convención o se mantiene la actual?) se decide en **ADR-0007** (ver [`../adr/`](../adr/)). |

### P1-4 · Naming de endpoints (`/api/treasury/...`, `/api/management/...`)

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Addendum dice** | §10: `/api/treasury/canonical-categories`, `/api/treasury/bank-movements/{id}/classify`, `/api/management/accounts/tree`, etc.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Realidad**      | El backend ya expone `/api/bank-movements/{movement_id}/classify` (**sin** prefijo `treasury`). Los demás namespaces (`/api/management/*`, `/api/treasury/*`, `/api/core/*`) **aún no existen** — se definen en el segundo handoff.                                                                                                                                                                                                                                                                                                                 |
| **Resolución**    | ⚠️ **Drift de contrato a resolver con CC-API en el handoff, NO en el FE.** El FE jamás inventa el path: consume el que el OpenAPI real exponga (`generate:api`). El brief de taxonomía a CC-API ([`taxonomy-handoff-brief.md`](./taxonomy-handoff-brief.md)) marca explícitamente que el **shape y los paths los confirma el backend**; si difieren del addendum, se actualiza el addendum (bidireccional, igual que el contrato SII). Stop condition §30 #2/#6 del addendum aplica: si el OpenAPI difiere, detenerse y reconciliar, no improvisar. |

---

## P2 — Gaps de proceso (resueltos en esta tanda de PRs)

| Gap                                                                                                    | Resolución                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Addendum vivía como `.docx` binario en la raíz (no versionable, no diffeable, no linkeable).           | ✅ Convertido a [`frontend-v2.md`](./frontend-v2.md) versionado; binario eliminado del repo. Regenerable desde el `.docx` si Fernando lo actualiza. |
| Decisiones arquitecturales nuevas sin ADR (estructura carpetas, feature flags, DnD, naming endpoints). | ✅ ADRs abiertos en [`../adr/`](../adr/) — ver ADR-0007+ (este PR / PR siguiente).                                                                  |
| Gate de preflight (§6.2) es prosa, no un check ejecutable.                                             | ⏳ Se materializa como script/CI cuando PR #83 sea viable (post-handoff). Documentado como pendiente en el ADR de proceso.                          |

---

## Qué se adopta del addendum SIN cambios (fortalezas)

No todo es conflicto — la mayor parte del addendum es excelente y se respeta tal cual:

- Secuencia incremental de PRs **#83→#89→Fase 2** (Tabla 19).
- **Stop conditions** §30 — alineadas con CLAUDE.md regla 16.
- **Microcopy de negocio** §8 + mapa de traducción técnico→humano (Tabla 5) —
  alineado con Anexo F (Voice & Tone).
- Matriz **RBAC** (Tabla 17) y **error mapping** (Tabla 18).
- "No romper los 6 módulos / login / C1-prep" — alineado con CLAUDE.md y Anexo B.7.
- DoD §28/§29 y batería de tests §26.

---

## Resumen ejecutivo de decisiones

| ID   | Conflicto                   | Resolución                                  | Dónde se ejecuta       |
| ---- | --------------------------- | ------------------------------------------- | ---------------------- |
| P0   | Backend no expone endpoints | Cola: #71 → 2º handoff → PRs #83+           | Brief CC-API + runbook |
| P1-1 | Edge Runtime                | No declarar runtime (gana CLAUDE.md)        | Cada página nueva      |
| P1-2 | Pages vs Workers            | Workers (gana realidad)                     | Sin acción de código   |
| P1-3 | `src/features/`             | Mapear a `src/components/` + `src/lib/api/` | ADR-0007               |
| P1-4 | Naming endpoints            | FE consume OpenAPI real, no inventa         | Handoff bidireccional  |
| P2   | Proceso (.docx, ADRs, gate) | Formalizado en esta tanda                   | Estos PRs              |

---

Generated by CC-WEB — 2026-05-15.
