# Revisión integral — Ciclo "editores de 3 dominios + banner §18.7" (Anexo K.4)

> **Autor:** CC-WEB (rol CTO) — 2026-05-22
> **Cubre:** todo lo mergeado desde el cierre del ciclo anterior
> ([3-dominios-cycle-handoff](./3-dominios-cycle-handoff.md), PR #154)
> hasta hoy. 4 PRs: #155 / #156 / #157 / #158 — todos mergeados a `main`.
> **Método del audit:** verificación directa sobre `main` real
> (HEAD `301f0da`). Todo ya está en producción del repo.

## TL;DR

- **0 críticos.** Los 3 dominios desbloqueados por el backend pasaron de
  read-only a **read + edit** el mismo día (#155 Monedas / #156 Reglas /
  #157 Plantillas). Además, el flujo §17 cierra con el **banner §18.7**
  (#158) ofreciendo sugerencia de regla derivada del movimiento.
- **🎯 Hito:** los **4 ítems del próximo-ciclo del handoff #154 que NO
  dependían de CC-API quedaron resueltos** en una sola sesión
  (#155-#158). Quedan 2 ítems que sí esperan CC-API: drag-drop priority
  §17.6 (endpoint reorder) y activación prod de flags via
  `/api/management/config`. Ya fueron comunicados a CC-API.
- **Patrón unificado consolidado**: los 3 editores usan el mismo stack
  (Base UI Dialog + react-hook-form + zod + schema/transforms aparte),
  ya documentado y replicable.
- **Suite en `main` verde:** typecheck · lint · 174 unit · build · 0 regresión.
- **Sin slips de proceso.** Cada PR mergeó con CI pasando; no hubo
  reverts ni recoveries.

## #1 — Inventario del ciclo

**PRs mergeados a `main`** (todos hoy 2026-05-22):

| PR       | Qué                                                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#155** | PR-MonEd: editor de Ajustes de Monedas (PATCH §15.4). Dialog Base UI + RHF + zod con 3 refinamientos de coherencia (funcional ∉ reporting §15.2, default_reporting ∈ reporting_codes, indexed_enabled ⇒ code). Empty state (settings=null §15.4) con CTA "Configurar monedas". 15 tests nuevos.                                 |
| **#156** | PR-RulEd: editor crear/editar reglas de clasificación (POST + PATCH §17). Dialog único reusable, `useCanonicalCategories` para poblar categoría, confidence en steps UX (50/60/70/80/90/95/100%). Scope acotado: no `management_account_id`/`dimension_assignments` (eso vive en el drawer §17), no drag-drop. 19 tests nuevos. |
| **#157** | PR-TplApp: apply confirmatorio de Plantillas (mode=add_missing §14.1). Dialog con summary + checkbox obligatorio. `replace_visibility` queda fuera de scope (decisión UX separada). Sin tests nuevos (handler MSW ya cubierto exhaustivamente).                                                                                 |
| **#158** | PR-Sug: banner §18.7 sugerir-regla en drawer §17. Read-only por contrato: el listado de reglas NO crece tras el suggest. Cableado vía slot opcional en el drawer (mantiene presentacional puro). `RuleFormDialog` pre-poblado con la sugerencia. 6 tests nuevos.                                                                |

**`main` HEAD:** `301f0da` (Merge #158).

**Archivos nuevos (10):**

- `src/components/monedas/currency-settings-form.ts` (+ test)
- `src/components/monedas/currency-settings-dialog.tsx`
- `src/components/monedas/currency-code-select.tsx`
- `src/components/reglas/rule-form-schema.ts` (+ test)
- `src/components/reglas/rule-form-dialog.tsx`
- `src/components/plantillas/apply-template-dialog.tsx`
- `src/components/clasificacion/suggest-rule-banner.tsx`

**Archivos modificados (4):**

- `src/components/monedas/currency-settings-view.tsx` (header + CTA)
- `src/components/reglas/rules-list-view.tsx` (botones Nueva/Editar)
- `src/components/plantillas/templates-gallery-view.tsx` (botón Aplicar + AppliedBox)
- `src/components/clasificacion/classification-drawer.tsx` (slot suggestionBanner)
- `src/components/clasificacion/por-clasificar-view.tsx` (cableado banner + RuleFormDialog lazy)

**Archivos borrados:** 0.

## #2 — Tests (sobre `main` real)

| Gate          | Resultado                                                                           |
| ------------- | ----------------------------------------------------------------------------------- |
| `typecheck`   | ✅ limpio (`tsc --noEmit` exit 0)                                                   |
| `lint`        | ✅ limpio (pre-commit ejecutó eslint --fix + prettier en cada PR)                   |
| `vitest unit` | ✅ **174/174** (134 pre-ciclo + 15 MonEd + 19 RulEd + 0 TplApp + 6 Sug = +40 tests) |
| `next build`  | ✅ limpio (23 rutas estáticas + dinámicas)                                          |
| `e2e` mobile  | ✅ pasó en CI de cada PR (no se ejecuta local)                                      |
| Chromatic UI  | ✅ stories existentes pasan; nuevas stories diferidas (próximo ciclo)               |

**Test counts por dominio:**

| Suite                                    | Antes ciclo | Después                      | Δ       |
| ---------------------------------------- | ----------- | ---------------------------- | ------- |
| currencies (data layer + form)           | 9           | 24 (+15 form)                | +15     |
| classification-rules (data layer + form) | 7           | 32 (+19 form, +6 suggestion) | +25     |
| industry-templates (data layer)          | 8           | 8                            | —       |
| total unit                               | 134         | 174                          | **+40** |

**Por qué TplApp sumó 0 tests:** el handler MSW de `mode=add_missing` ya
está cubierto en `industry-templates.test.ts` (3 tests específicos del
`/apply` endpoint: shape de la respuesta para `suggest_only` y
`add_missing`, y 404 para template inexistente). El dialog en sí es UI
puro (un checkbox que habilita el botón) y el proyecto `unit` corre
Node-puro sin jsdom — donde haya lógica UI no trivial, va a Storybook.

## #3 — Sin regresiones

Verificado:

- ✅ **Navegación intacta**: el módulo sidebar de Administración mantiene
  todos sus links; `/caja/por-clasificar` sigue funcionando con el flujo
  §17 anterior (el banner es **opcional y aditivo**, no bloquea
  clasificar — si el endpoint falla, el resto del drawer funciona).
- ✅ **Pantallas previas funcionando**: las views read-only de los 3
  dominios (#151/#152/#153) **siguen igual** — los editores se agregaron
  como botones nuevos en headers y como CTAs en empty states, no
  reemplazan nada. Lo mismo aplica a `por-clasificar-view`: el botón
  "Guardar y crear regla" del drawer sigue funcionando exactamente como
  antes (path independiente del banner §18.7, que es pre-clasificación).
- ✅ **API contracts intactos**: cero modificaciones manuales a
  `types.ts`. Todos los hooks de mutación usados ya existían en main
  desde el sprint anterior.
- ✅ **Feature flags**: los 3 dominios siguen gateados detrás de sus
  flags (`multiCurrency`, `classificationRules`, `industryTemplates`),
  default OFF (ADR-0008). El banner §18.7 se monta dentro del drawer §17
  que ya está gateado por su propio flow.

## #4 — Coherencia (reglas + ADRs)

| Regla / ADR                                  | Estado | Notas                                                                                                                                                    |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regla 3 (no hand-edit `types.ts`)            | ✅     | Todos los requests/responses vienen del OpenAPI generado                                                                                                 |
| Regla 4 (sin `runtime` export)               | ✅     | Ninguna page modificada agrega `export const runtime`                                                                                                    |
| Regla 5 (Edge-compatibility)                 | ✅     | Cero deps nuevas; Base UI Dialog + RHF + zod ya en main                                                                                                  |
| Regla 11 (1 PR = 1 issue)                    | ✅     | Cada PR cierra una pieza del próximo-ciclo del handoff #154                                                                                              |
| Regla 12 (<300 líneas excl. tests/generados) | ✅     | MonEd ~220, RulEd ~280, TplApp ~180, Sug ~150                                                                                                            |
| Regla 14 (firma CC-WEB)                      | ✅     | Todos los commits + PRs llevan la firma                                                                                                                  |
| Regla 16 (no inventar contrato)              | ✅     | Banner §18.7 usa solo los 4 campos estables documentados de `SuggestRuleResponse`; forward-compat ante valores nuevos del backend (helpers de narrowing) |
| ADR-0007 (sin `src/features/`)               | ✅     | Componentes viven en `src/components/{monedas,reglas,plantillas,clasificacion}/`                                                                         |
| ADR-0008 (flags default OFF)                 | ✅     | Sin cambios al fallback prod                                                                                                                             |
| ADR-0010 (sin combobox library)              | ✅     | Todos los selects son `<select>` nativo (catálogos cortos) o checkbox group para multi                                                                   |

**Patrón consolidado** documentable como referencia para futuros editores:

```
componente/{dominio}/
  ├── {dominio}-form-schema.ts       (zod schema + transforms — testeable Node-puro)
  ├── {dominio}-form-schema.test.ts  (vitest unit)
  ├── {dominio}-form-dialog.tsx      (Base UI Dialog + RHF + zodResolver, lazy desde la view)
  └── {dominio}-view.tsx             (importa el dialog via next/dynamic ssr:false)
```

Los 3 editores siguen este patrón.

## #5 — Definition of Done (DoD)

Doc maestro v2.6.4 §13 — DoD por feature:

| Ítem                                           | Estado                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tests vitest pasando localmente antes de PR    | ✅ 174/174 en `main`                                                                                       |
| Tipos generados (`generate:api` reciente)      | ✅ Schema actual (#144) cubre los 4 PRs sin regenerar                                                      |
| Sin `any` injustificado                        | ✅ Solo `as` narrowings en helpers de forward-compat (documentados)                                        |
| Sin Node-only APIs                             | ✅ Verificado por build (`workerd` target)                                                                 |
| Sin localStorage/sessionStorage para auth      | ✅ N/A (estos PRs no tocan auth)                                                                           |
| Voice & Tone Anexo F                           | ✅ Copys en español neutro Chile, sin jerga técnica visible al user                                        |
| A11y básica (labels + roles ARIA)              | ✅ Cada input/select tiene `<label htmlFor>`; alerts con `role="alert"`; status banner con `role="status"` |
| Bundle dentro de budget                        | ✅ Ver #6                                                                                                  |
| Lighthouse mobile ≥85 `/login` y ≥90 `/inicio` | ✅ CI pasó Lighthouse en cada PR (ver #155 check `lighthouse pass 2m57s`)                                  |

## #6 — Bundle (lectura final post-`next build`)

| Ruta                                       | Size        | First Load JS | Δ vs handoff #154                                 |
| ------------------------------------------ | ----------- | ------------- | ------------------------------------------------- |
| `/administracion`                          | 4.03 kB     | 120 kB        | —                                                 |
| `/administracion/credenciales`             | 30.5 kB     | 190 kB        | —                                                 |
| `/administracion/estructura-gestion`       | 1.90 kB     | 127 kB        | —                                                 |
| **`/administracion/monedas`**              | **6.25 kB** | **130 kB**    | dialog en chunk lazy                              |
| **`/administracion/plantillas`**           | **7.53 kB** | **132 kB**    | dialog en chunk lazy (+2 kB total)                |
| **`/administracion/reglas-clasificacion`** | **6.03 kB** | **130 kB**    | dialog en chunk lazy                              |
| `/administracion/usuarios`                 | 18.9 kB     | 150 kB        | —                                                 |
| `/administracion/vistas-gestion`           | 1.30 kB     | 126 kB        | —                                                 |
| `/caja`                                    | 2.72 kB     | 115 kB        | —                                                 |
| **`/caja/por-clasificar`**                 | **5.76 kB** | **134 kB**    | banner §18.7 cableado + dialog lazy (+3 kB total) |
| `/inicio`                                  | 2.67 kB     | 115 kB        | —                                                 |
| `/login`                                   | 4.98 kB     | 149 kB        | —                                                 |
| First Load shared                          | —           | 103 kB        | —                                                 |

**Observaciones:**

- Los 3 dialogs editores **NO entran a First Load JS** — viven en
  chunks lazy (`next/dynamic ssr:false`). El "Size" de la ruta crece
  porque incluye el código orquestador del editor en la view, pero el
  bundle del dialog (Base UI Dialog + RHF + zod) solo se descarga cuando
  el user lo abre. Esto preserva el budget de First Load del Lighthouse.
- **Refactor crítico durante PR-Sug**: la primera versión arrastraba
  zod al chunk de `/caja/por-clasificar` (+21 kB total). Moviendo el
  transform `suggestionToFormValues` al dialog (que ya es lazy), bajó a
  +3 kB. Documentado en el commit del PR.

## #7 — Documentación

| Doc                                                 | Estado                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Comentarios in-code densos en cada componente nuevo | ✅ Cada archivo abre con un bloque explicando §referenciado, decisiones de scope, y por qué del transform/lazy |
| ADRs nuevos requeridos                              | ❌ ninguno — todo respeta ADRs vigentes                                                                        |
| Este audit K.4                                      | ✅ este archivo                                                                                                |
| README / CHANGELOG                                  | ⏸ pendientes para el cierre del milestone (no por feature)                                                     |

## #8 — Lecciones del ciclo

1. **El patrón "schema aparte" pagó dividendos**: extraer el schema +
   transforms a un archivo `.ts` puro (sin React) permitió tests unit
   en Node sin requerir jsdom, alineado al setup vigente del repo. Los
   3 editores lo adoptaron sin fricción.
2. **Lazy del dialog ES crítico para bundle**: los 3 editores + el
   banner §18.7 importan Base UI Dialog + RHF + zod, que combinados
   pesan ~30-40 kB. Sin `next/dynamic ssr:false`, cada vista subiría
   ese peso al First Load. Con lazy, el First Load se mantiene casi
   plano y solo paga el costo cuando el user abre el editor.
3. **Bundle leak por transform en módulo compartido**: si una view
   importa una función pura de otro módulo que también jala
   dependencias pesadas (ej. `suggestionToFormValues` desde
   `rule-form-schema.ts` que importa zod), el bundler arrastra todo al
   chunk de la view. Solución: mover el call al consumidor lazy (el
   propio dialog). Catch importante durante el PR-Sug.
4. **Slot pattern + presentacional puro**: el `ClassificationDrawer`
   ya estaba diseñado como presentacional puro. Agregar el banner
   §18.7 sin romper esa propiedad fue trivial vía slot
   `suggestionBanner?: React.ReactNode`. El drawer sigue ignorando el
   estado del banner, lo monta el contenedor con sus hooks.
5. **El comentario "El gating fino lo hace el backend"** establecido
   en `usuarios/page.tsx` se reusó verbatim en los 3 editores
   (Monedas/Reglas/Plantillas). No re-implementamos role checks en UI;
   confiamos en el 403 del backend renderizado vía
   `apiErrorToUserMessage`. Patrón consistente.

## #9 — Estado del próximo-ciclo del handoff #154

Recap del handoff anterior:

| Ítem                                                            | Estado                                           |
| --------------------------------------------------------------- | ------------------------------------------------ |
| Editores de cada dominio (Monedas/Reglas/Plantillas)            | ✅ #155-#157 mergeados                           |
| Drag-drop priority §17.6                                        | ⏸ Espera endpoint reorder en CC-API (comunicado) |
| Banner §18.7 (suggest-rule) en drawer §17                       | ✅ #158 mergeado                                 |
| Storybook stories de wired views + helper `QueryClientProvider` | ⏸ Posible siguiente PR si Fernando lo prioriza   |

**Bloqueantes backend conocidos (sin cambio respecto del handoff #154):**

- `/api/management/config` no existe → flags addendum siguen OFF en
  prod por fallback ADR-0008. Comunicado a CC-API. Sin este endpoint
  los 3 editores + el banner §18.7 quedan invisibles en prod.

## #10 — Próximo ciclo — propuesta

Una vez que CC-API entregue `/api/management/config` y/o el endpoint
reorder, los siguientes movimientos sugeridos:

1. **Activar el flag fetch en `resolveFeatureFlags()`** — pasa de
   resolver desde `.env.local` overrides a también consultar el
   endpoint cuando esté disponible. Defaults siguen siendo OFF.
2. **Drag-drop priority de reglas §17.6** — wrapper sobre la lista
   actual de `RulesListView`, usando el patrón dependency-free de
   ADR-0009 (sin `@dnd-kit` por ahora). El endpoint reorder atómico
   resuelve el problema de N PATCHs sucesivos.
3. **Storybook stories de wired views** — helper
   `QueryClientProvider` reusable + 3 stories (Monedas/Reglas/Plantillas)
   - 1 story del drawer §17 con banner §18.7. Visual baseline para
     Chromatic regresiones.
4. **`replace_visibility` en plantillas** — feature más invasiva (toca
   visibility de dimensions existentes). Requiere decisión UX
   separada (¿confirmación adicional por dimension a tocar?). No urgente.

---

Generated by CC-WEB — 2026-05-22.
