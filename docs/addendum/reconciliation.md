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

> **⚠️ Actualización 2026-05-16 — P0 YA NO SE CUMPLE.** La verificación dura
> de hoy (ver **[P4](#p4--verificación-dura-del-openapi-de-prod-2026-05-16)**)
> muestra que el backend **bajó la mayor parte de la capa de
> taxonomía/gestión a prod** entre el 15 y el 16. P0 documenta el estado al
> **2026-05-15**; léase junto con P4. El bloqueo dejó de ser "backend no
> expone nada" y pasó a ser "3 dominios faltan + drift de credenciales SII a
> reconciliar + confirmación oficial del handoff pendiente".

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

## P3 — Datos duros del backend (Addendum Técnico Escalamiento `qavante-api`, 2026-05-16)

Fernando compartió el `QAVANTE_ADDENDUM_TECNICO_ESCALAMIENTO.docx` de `qavante-api`
("Arquitectura 1→50→100 Clientes"). De sus 7 refactors, **3 cierran preguntas
abiertas de este handoff con datos reales** — ya no son hipótesis del addendum FE:

### P3-1 · `canonical_category` = ENUM CERRADO (resuelve stop condition §30)

El backend cierra `canonical_category` de `TEXT` libre a un **ENUM PostgreSQL
de 16 valores** (migration `0026_canonical_category_enum.sql`):

```text
revenue_sales · revenue_services · cogs_materials · cogs_labor ·
payroll_salaries · payroll_benefits · taxes_vat · taxes_income ·
taxes_municipal · capex_equipment · capex_property ·
financing_loan_disbursement · financing_loan_payment ·
treasury_transfer_in · treasury_transfer_out · uncategorized
```

- **Responde** la stop condition §30 del addendum FE ("si backend devuelve
  `canonical_category` como string libre sin metadata, detenerse"): **es enum
  estructurado, no string libre**. ✅ El FE puede proceder cuando baje.
- **Drift de taxonomía confirmado:** estos 16 valores (categorías contables /
  P&L) **NO coinciden** con la lista del addendum FE §10.1 / Tabla 7
  (`client_collection`, `supplier_payment`, `card_processor_settlement`,
  `payroll_payment`, `tax_payment`… — taxonomía de flujo de caja operativo).
  Son **dos taxonomías distintas**.
- **Resolución autoritativa:** **gana el enum del backend** (es el contrato
  real, migration aplicada). El FE adopta los 16 valores reales y los mapea a
  labels humanos (addendum FE §11 / Tabla 5 sigue siendo el patrón de
  traducción, pero sobre el enum real). La lista de la Tabla 7 del addendum FE
  queda **obsoleta como contrato** — es referencia de intención UX, no de
  valores. El brief de taxonomía ([`taxonomy-handoff-brief.md`](./taxonomy-handoff-brief.md))
  se actualiza con esto.

### P3-2 · Patrón async-task para syncs pesados (cambia el contrato de ingesta)

El backend refactoriza los syncs pesados (BICE/Previred/SII ingesta) de
síncrono a **task queue**: `POST /x/sync → {task_id, status:"pending"}` +
`GET /x/sync/{task_id}` (polling).

- **Impacto FE:** los hooks TanStack de ingesta dejan de ser "fetch que
  devuelve data" → pasan a "iniciar task + `refetchInterval` hasta
  `status:done`". Patrón reutilizable a construir cuando baje.
- **Afecta a ambos handoffs:** el contrato SII (`c1-sii-credentials.md`) y el
  brief taxonomía asumían ingesta síncrona. La **configuración** de
  credenciales (PUT/GET) probablemente sigue síncrona; lo que cambia es la
  **ejecución del sync/ingesta**. CC-API debe confirmar qué endpoints son
  async-task. Registrado en el brief.

### P3-3 · Multi-tenant API keys — transparente al FE (verificado)

El backend pasa de `SERVER_API_KEY` global a tabla `core.api_keys`. **El FE de
`qavante-web` no usa API keys** — autentica por cookie de sesión httpOnly
(verificado por `grep` en `src/`, 2026-05-16: cero usos). El cambio es
server-to-server, **transparente al flujo de usuario**. Único spillover futuro:
si baja `/admin/api-keys`, sería UI nueva no contemplada (registrado como
issue, no en scope del addendum FE v2.0).

> Los refactors backend #1 (RLS), #3 (BICE automation), #4 (connection
> pooling), #7 (rate limiting) son internos del backend — transparentes al FE,
> sin cambio de contrato ni código.

---

## P4 — Verificación dura del OpenAPI de prod (2026-05-16)

**Método:** `curl https://tooxs-gestion-api.fly.dev/openapi.json` el
2026-05-16, parseo de `paths`. Resultado: **73 paths** (vs. 59 el 2026-05-15).
Esto **invierte P0**: el 2º handoff backend bajó (parcial) a prod.

### P4-1 · Inventario verificado vs. addendum §10

| Dominio addendum                                       | Path real en prod (2026-05-16)                                                                              | Estado                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Canonical categories (§10.1)                           | `/api/treasury/canonical-categories`                                                                        | ✅ **LIVE**                                                                                                                   |
| Management accounts (§10.2)                            | `/api/management/accounts`, `/tree`, `/{id}`, `/{id}/move`, `/{id}/toggle-active`, `/{id}/toggle-visible`   | ✅ **LIVE** (CRUD+move+toggles completos)                                                                                     |
| Management dimensions (§10.4)                          | `/api/management/dimensions`, `/{id}`, `/{id}/values`                                                       | ✅ **LIVE**                                                                                                                   |
| Dimension values / assignments (§10.5)                 | `/api/management/dimension-values/{id}`, `/{id}/move`, `/api/management/dimension-assignments`, `/{id}`     | ✅ **LIVE**                                                                                                                   |
| Bank movement classify (§10.7)                         | `/api/bank-movements/{movement_id}/classify` — **sin** prefijo `treasury`                                   | ✅ **LIVE** (confirma P1-4)                                                                                                   |
| SII ingesta C1 (#71 destrabe)                          | `/api/sii/f29/{folio}`, `/pdf`, `/api/sii/rcv/compras`, `/ventas`, `/api/sii/bhe`, `/api/sii/dte-recibidos` | ✅ **LIVE**                                                                                                                   |
| Payroll / banco / TGR / Pulso                          | `/api/buk/*`, `/api/bice/*`, `/api/tgr/*`, `/api/confianza/score`                                           | ✅ **LIVE**                                                                                                                   |
| Industry templates (§10.3)                             | —                                                                                                           | ❌ **AUSENTE**                                                                                                                |
| Currencies / exchange-rates / company-settings (§10.6) | —                                                                                                           | ❌ **AUSENTE**                                                                                                                |
| Classification rules CRUD + suggest-rule (§10.7)       | —                                                                                                           | ❌ **AUSENTE**                                                                                                                |
| Feature-flags config (`/api/management/config`)        | —                                                                                                           | ❌ **AUSENTE** → aplica fallback [ADR-0008](../adr/0008-feature-flags-gating-pantallas-sin-backend.md) (presencia en OpenAPI) |

### P4-2 · Drift de credenciales SII (handoff #71) — **bloqueante, requiere decisión humana**

El contrato [`c1-sii-credentials.md`](../backend-contracts/c1-sii-credentials.md)
especificaba **6 endpoints `/api/credentials/sii/*`**. El backend **no** los
expone; en su lugar shipeó un **modelo genérico de fuentes**:

```text
/api/admin/sources
/api/admin/sources/{source_code}
/api/admin/sources/{source_code}/credential
/api/admin/sources/{source_code}/credential/test
/api/admin/sources/{source_code}/consent
/api/admin/sources/{source_code}/sync-config
```

Esto es un **drift de contrato de shape + path**, no un `generate:api`
mecánico. Por **CLAUDE.md regla 16** (y el carácter bidireccional del
[runbook SII](../backend-contracts/c1-sii-handoff-runbook.md) §3) **NO se
parchea en silencio**. Decisión pendiente de Fernando:

- **Opción 1 — el FE se adapta al modelo `admin/sources` genérico** (el
  backend ya lo deployó; SII pasa a ser un `source_code` más). Implica
  reescribir tipos hand-rolled de `credentials.ts` + handlers MSW + UI de
  `/administracion/credenciales` contra el shape genérico.
- **Opción 2 — se pide a CC-API volver al contrato `/api/credentials/sii`**
  (más trabajo backend, menos churn FE; el contrato ya estaba cerrado).

Hasta resolver esto, `npm run generate:api` queda **diferido**: regenerar
ahora arrastra el shape genérico y rompería los tipos hand-rolled sin una
decisión tomada.

### P4-3 · Resolución autoritativa

- **El handoff de taxonomía/gestión está mayormente DESTRABADO.** La cola de
  [P0](#p0--supuesto-de-estado-falso-bloqueante) se reordena: lo que faltaba
  no es "todo el backend" sino **3 dominios** (industry-templates, currencies,
  classification-rules) + `suggest-rule` + el drift SII.
- **Trabajo FE que se puede ejecutar YA sin más backend** (no inventa tipos):
  feature-flags ([ADR-0008](../adr/0008-feature-flags-gating-pantallas-sin-backend.md))
  con default OFF, esqueletos de ruta con estado feature-unavailable,
  componentes presentacionales puros + Storybook. Es el alcance "PR #83" del
  addendum **sin** `generate:api`.
- **Lo que sigue esperando backend/decisión:** integración real de datos
  (post-decisión drift SII + confirmación oficial del handoff), Monedas,
  Reglas CRUD, Plantillas de industria.

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

| ID   | Conflicto                      | Resolución                                                                         | Dónde se ejecuta          |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------- |
| P0   | Backend no expone endpoints    | Cola: #71 → 2º handoff → PRs #83+                                                  | Brief CC-API + runbook    |
| P1-1 | Edge Runtime                   | No declarar runtime (gana CLAUDE.md)                                               | Cada página nueva         |
| P1-2 | Pages vs Workers               | Workers (gana realidad)                                                            | Sin acción de código      |
| P1-3 | `src/features/`                | Mapear a `src/components/` + `src/lib/api/`                                        | ADR-0007                  |
| P1-4 | Naming endpoints               | FE consume OpenAPI real, no inventa                                                | Handoff bidireccional     |
| P2   | Proceso (.docx, ADRs, gate)    | Formalizado en esta tanda                                                          | Estos PRs                 |
| P3-1 | `canonical_category` enum      | Gana enum backend (16 valores, migr. 0026)                                         | Brief taxonomía + FE      |
| P3-2 | Syncs async-task               | FE adopta task_id + polling                                                        | Brief taxonomía + FE      |
| P3-3 | Multi-tenant API keys          | Transparente (FE solo cookie, verificado)                                          | Sin acción de código      |
| P4-1 | Backend bajó a prod (73 paths) | Taxonomía/gestión LIVE; P0 invertido                                               | Reordena cola del handoff |
| P4-2 | Drift credenciales SII         | `admin/sources` genérico vs contrato `/credentials/sii` — **decisión de Fernando** | Bloquea `generate:api`    |
| P4-3 | Faltan 3 dominios              | industry-templates / currencies / classification-rules + suggest-rule              | Siguen esperando backend  |

---

Generated by CC-WEB — 2026-05-15 (P3 agregado 2026-05-16 con datos del Addendum Técnico Escalamiento `qavante-api`; P4 agregado 2026-05-16 con verificación dura del `/openapi.json` de prod).
