# Brief de handoff — Taxonomía / gestión / multimoneda (2º handoff backend)

> **Para:** CC-API (Claude Code en el repo `qavante-api`), vía Fernando como
> puente humano.
> **De:** CC-WEB (rol CTO).
> **Fecha:** 2026-05-15.
> **Patrón:** mismo que el handoff de credenciales SII — ver
> [`../backend-contracts/c1-sii-handoff-runbook.md`](../backend-contracts/c1-sii-handoff-runbook.md).
> Ningún agente ve el repo del otro; Fernando transporta artefactos.

---

## 1. Qué es este handoff y por qué existe

El [addendum frontend v2.0](./frontend-v2.md) especifica una capa grande de
producto: estructura de gestión (taxonomía/management accounts), vistas de
gestión (dimensions), multimoneda, plantillas por industria, reglas de
clasificación y clasificación de movimientos bancarios.

**Estado al 2026-05-15:** el OpenAPI de prod (59 paths) no exponía ninguno
de estos endpoints. El addendum (Tabla 2) asumía "Backend C1 100% / C2
implementado" — era incorrecto. Ver [`reconciliation.md`](./reconciliation.md) P0.

> **🔄 Actualización 2026-05-16 (verificación dura):** el OpenAPI de prod
> ahora expone **73 paths** y **la mayor parte de este handoff ya está LIVE**
> (canonical-categories, management/accounts+tree+move+toggles,
> management/dimensions+values+assignments, bank-movements/classify, SII f29
> ingesta). **Faltan solo 3 dominios**: industry-templates, currencies,
> classification-rules (+ `suggest-rule`, + `/management/config`). Además hay
> un **drift de credenciales SII** (`admin/sources` genérico vs contrato
> `/credentials/sii`). Detalle e inventario completo en
> [`reconciliation.md`](./reconciliation.md) **P4**. Este brief sigue siendo
> el insumo de co-diseño para los 3 dominios faltantes y para resolver el
> drift; ya no aplica como "el backend no expone nada".

Por lo tanto: **este es un handoff de especificación, no de integración.** El
addendum define lo que el FE espera; CC-API tiene que **diseñar, confirmar e
implementar** el contrato backend real. No es "el FE ya está, conectá" — es
"acá está la expectativa FE, definí el contrato y construilo".

## 2. Diferencia crítica con el handoff SII

|                            | Handoff SII (#71)                                                                                          | Este handoff (taxonomía)                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Contrato backend           | **Completo y cerrado** (`c1-sii-credentials.md`, 399 líneas, shapes/errores/permisos definidos por CC-WEB) | **NO existe.** El addendum §10 da _shapes esperados FE_, no un contrato backend validado |
| Rol de CC-API              | Implementar contra contrato cerrado                                                                        | **Co-diseñar** el contrato + implementar                                                 |
| Fuente de verdad del shape | El contrato escrito                                                                                        | El **OpenAPI que CC-API publique** manda; el addendum es input, no ley                   |

**Implicancia:** los JSON de ejemplo del addendum §10 son una _propuesta de
partida_, no un contrato. CC-API debe devolver el contrato real (paths +
shapes + enums + errores + permisos), y si difiere del addendum, **CC-WEB
ajusta el addendum y sus mocks** — es bidireccional.

## 3. Lo que CC-WEB necesita que CC-API defina e implemente

Dominios (del addendum §10), en orden de prioridad para desbloquear los PRs FE:

1. **Canonical categories** (`§10.1`) — tipos de movimiento con metadata
   (label, dirección esperada, cashflow group, etc.). Es metadata read-only;
   probablemente el más simple. Desbloquea el drawer de clasificación.
2. **Management accounts tree** (`§10.2`) — árbol de categorías de gestión +
   CRUD + `move` + toggles. Desbloquea PR #84.
3. **Management dimensions + values** (`§10.4`, `§10.5`) — vistas de gestión.
   Desbloquea PR #85.
4. **Bank movement classification** (`§10.7`) — clasificar movimiento +
   crear regla. Desbloquea PR #86.
5. **Currencies + exchange rates + company settings** (`§10.6`). PR #87.
6. **Classification rules CRUD** (`§10.7`). PR #88.
7. **Industry templates** (`§10.3`). PR #89.

## 4. Puntos que CC-API DEBE resolver/confirmar (no asumir)

Estos son los que bloquean decisiones FE ya tomadas en ADRs:

- **Naming/namespace de paths.** El addendum usa `/api/treasury/...`,
  `/api/management/...`, `/api/core/...`. Pero el backend real ya expone
  `/api/bank-movements/{id}/classify` **sin** prefijo `treasury`. CC-API
  decide el namespace definitivo y lo refleja en `/openapi.json`. El FE
  consume lo que el OpenAPI diga (nunca inventa el path) — ver
  [`reconciliation.md`](./reconciliation.md) P1-4. **Decisión esperada de
  CC-API:** ¿se mantiene `/api/bank-movements/...` y los nuevos cuelgan de
  ahí, o se migra a `/api/treasury/...`? Si se migra, ¿hay deprecación del
  path viejo?
- **`GET /api/management/config` (feature flags).** [ADR-0008](../adr/0008-feature-flags-gating-pantallas-sin-backend.md)
  define que el FE gatea pantallas con flags. ¿El backend expondrá este
  endpoint con qué shape? Si **no** lo va a exponer, confirmar que el FE
  puede derivar disponibilidad por presencia del endpoint en el OpenAPI
  (fallback del ADR-0008).
- **Endpoints `move`.** [ADR-0009](../adr/0009-politica-drag-and-drop.md)
  hace que el DnD del FE dependa de `POST /api/management/accounts/{id}/move`
  y `POST /api/management/dimension-values/{id}/move`. Confirmar existencia,
  payload exacto (`{new_parent_id, sort_order}`) y comportamiento ante ciclo
  (¿código de error `category_cycle_detected` / `dimension_cycle_detected`
  como en addendum Tabla 18?). ✅ **Existencia confirmada 2026-05-16** por P4
  (ambos paths LIVE); falta validar payload/error al regenerar tipos.
- **Permisos.** ¿RBAC backend devuelve 403 según la matriz del addendum
  Tabla 17 (owner/admin escriben, finance_manager/viewer no)? El FE oculta
  acciones pero el backend debe validar.
- **`canonical_category`: enum o string libre.** ✅ **RESUELTO 2026-05-16 por
  el contrato vivo** (revierte la lectura previa del doc de escalamiento — ver
  [`reconciliation.md`](./reconciliation.md) **P4-4**). El `/openapi.json`
  desplegado expone `GET /api/treasury/canonical-categories` →
  `CanonicalCategoryMeta`: **enum de 26 valores = addendum §11/Tabla 7**
  (`client_collection`, `supplier_payment`, …) **con `label` humano +
  `description` + `expected_direction` + `cashflow_group` + …** — exactamente
  el shape del addendum §10.1. **El FE NO hardcodea labels**: los consume de la
  metadata. **✅ CERRADO 2026-05-17 por CC-API (R-2, ratificado por
  Fernando):** la lista de 16 (AD-ESC #6) fue **descartada formalmente** —
  nunca existió `0026_canonical_category_enum` (la `0026` real es
  multimoneda). Las **26 son el contrato congelado** (StrEnum + CHECK 0023 +
  metadata + endpoint). Futuro solo aditivo y anunciado vía OpenAPI (§7.3).
  **Cero rework FE.** CC-API publicó además el OpenAPI formal de taxonomía
  (`/api/treasury/*`); ver `reconciliation.md` P4-4 para el detalle.
- **Patrón de ejecución de syncs: ¿síncrono o async-task?** El Addendum
  Técnico Escalamiento (#5) refactoriza los syncs pesados (ingesta
  BICE/Previred/SII) a task queue: `POST /x/sync → {task_id}` +
  `GET /x/sync/{task_id}` polling. Confirmar **qué endpoints de ingesta son
  async-task** vs cuáles siguen síncronos (la _configuración_ de credenciales
  PUT/GET probablemente sigue síncrona; la _ejecución_ del sync no). El FE
  construye un patrón `useAsyncTask` reutilizable según esto.
- **Decisiones de almacenamiento/arquitectura backend** (análogo a ADR-0006
  de SII): si hay decisiones no triviales (cómo se modela el árbol, RLS por
  tenant, etc.), CC-API abre su propio ADR en `qavante-api/docs/adr/`.

## 5. Restricciones que el FE ya fijó (CC-API debe respetarlas en el diseño)

- El FE **nunca** mostrará `canonical_category`, `dimension_id`, etc. al
  usuario — necesita **labels humanos en la metadata** (addendum §11, Tabla 5).
  Los endpoints de metadata deben traer `label`/`display_name`.
- El FE **no calcula** finanzas (conversión de moneda, forecast, etc.). El
  backend entrega valores ya calculados o el FE solo formatea (addendum §16.3).
- Tenant isolation obligatorio (igual que SII): todo scoped por `tenant_id`,
  errores `*_cross_tenant` como en Tabla 18.

## 6. DoD del handoff (cuándo está listo para que CC-WEB integre)

- [~] CC-API publica contrato cubriendo los 7 dominios del §3 — **parcial
  (2026-05-16):** 4 de 7 dominios LIVE en `/openapi.json`; faltan
  industry-templates, currencies, classification-rules.
- [~] `/openapi.json` expone los paths con shapes + enums + errores +
  permisos — **parcial:** paths LIVE verificados (P4-1); falta validar
  shapes/enums/permisos al regenerar tipos (diferido por drift SII).
- [x] Naming de paths resuelto (punto §4) — **confirmado por OpenAPI real:**
      `/api/management/*`, `/api/treasury/canonical-categories`, y
      `/api/bank-movements/{id}/classify` **sin** prefijo `treasury` (P1-4).
- [ ] `/management/config` definido — **NO existe (2026-05-16)** → el FE usa
      el fallback de [ADR-0008](../adr/0008-feature-flags-gating-pantallas-sin-backend.md)
      (presencia del endpoint en el OpenAPI).
- [x] Endpoints `move` confirmados — **LIVE:**
      `/api/management/accounts/{id}/move` y
      `/api/management/dimension-values/{id}/move` presentes. Falta validar
      payload exacto + error de ciclo al regenerar tipos.
- [ ] CC-API abre ADR(s) en su repo para decisiones backend no triviales.
- [ ] Fernando avisa a CC-WEB: "2º handoff (taxonomía) arriba en prod"
      (oficial) — **+ resolver el drift de credenciales SII (P4-2): ¿FE se
      adapta a `admin/sources` o backend vuelve al contrato `/credentials/sii`?**

Recién con eso CC-WEB ejecuta los PRs #83→#89 (PR #83 = integración:
`generate:api`, hooks, query keys, feature flags, skeletons; ver
[reconciliation P0](./reconciliation.md) para el orden real, dado que la
numeración del addendum asumía un estado que no se cumplió).

## 7. Brief listo para pegarle a CC-API

> Texto para que Fernando pegue a Claude Code en `qavante-api`. Ajustá rutas
> si copiás los docs al repo backend.

```
Hola CC-API. Segundo handoff frontend→backend (el primero fue credenciales
SII, #71). Este es la capa de taxonomía/gestión/multimoneda.

Diferencia clave con el de SII: el contrato backend NO está escrito. El
addendum frontend (te paso docs/addendum/frontend-v2.md) define lo que el
FE ESPERA, pero vos tenés que DISEÑAR y CONFIRMAR el contrato real, no
solo implementar. Los JSON del §10 son propuesta de partida, no ley. Si tu
diseño difiere, avisás a Fernando y CC-WEB ajusta el addendum + sus mocks
(bidireccional).

Necesito, en este orden de prioridad:
1. Canonical categories (metadata read-only con labels humanos).
2. Management accounts tree + CRUD + move + toggles.
3. Management dimensions + values.
4. Bank movement classification + create rule.
5. Currencies + exchange rates + company currency settings.
6. Classification rules CRUD.
7. Industry templates.

Decisiones que tenés que resolver explícitamente (bloquean ADRs del FE):
- Namespace de paths: el FE espera /api/management|treasury|core/* pero
  vos ya exponés /api/bank-movements/{id}/classify sin prefijo treasury.
  Definí el namespace final y si deprecás el path viejo.
- ¿Vas a exponer GET /api/management/config para feature flags? Si no,
  confirmá que el FE puede derivar disponibilidad por presencia del
  endpoint en el OpenAPI.
- Endpoints move ({new_parent_id, sort_order}) + error de ciclo. Si no
  los hacés ahora, el FE sale sin drag-and-drop (reordena por menú).
- RBAC: 403 según matriz owner/admin escriben, finance_manager/viewer no.
- canonical_category DEBE venir con metadata estructurada (label,
  dirección, etc.), no string libre.

Restricciones del FE que tu diseño debe respetar:
- Toda metadata necesita label/display_name humano (el usuario nunca ve
  nombres técnicos).
- El FE no calcula finanzas; backend entrega calculado o FE solo formatea.
- Tenant isolation obligatorio, errores *_cross_tenant.

Abrí ADR en qavante-api/docs/adr/ para decisiones backend no triviales
(modelo del árbol, RLS, etc.).

Al terminar: /openapi.json en prod con todos los paths + avisá a Fernando
"2º handoff taxonomía arriba en prod". Decime tu plan y el contrato
propuesto ANTES de implementar.
```

---

## 8. Resumen para Fernando

1. Mergear los PRs de esta tanda (#83 addendum formalizado → #84 ADRs →
   #85 este brief, en ese orden).
2. Llevar `docs/addendum/frontend-v2.md` (+ opcional `reconciliation.md`)
   al repo `qavante-api`.
3. Pegarle a CC-API el brief de §7.
4. CC-API confirma plan + contrato propuesto → vos lo revisás → implementa
   → deploya a prod.
5. Avisás a CC-WEB "2º handoff taxonomía arriba" → CC-WEB ejecuta PRs
   #83→#89 del addendum (numeración real puede diferir; orden en
   reconciliation P0).

Mientras tanto, **el handoff SII (#71) sigue siendo prioridad y va primero**
— es prerequisito de Sprint C1 y ya tiene contrato cerrado. Este 2º handoff
es paralelo/posterior, no lo reemplaza.

---

Generated by CC-WEB — 2026-05-15.
