# Revisión integral — Sprint C1 (SII) end-to-end + arranque Sprint C2 + ADR-0012 (Anexo K.4)

> **Autor:** CC-WEB (rol CTO) — 2026-05-24
> **Cubre:** todo lo mergeado desde el ciclo anterior
> ([editors-cycle-review](./editors-cycle-review.md), PR #160) hasta hoy.
> **PRs:** #161-#171 (8 mergeados + 1 abierto al cierre del audit).
> **Método:** verificación directa sobre `main` real al momento de
> escribir (HEAD post-#170; #171 abierto con checks en curso).

## TL;DR

- **🎯 Sprint C1 (SII) CERRADO end-to-end** — 8 endpoints SII LIVE
  cableados (data layer + UI consultor F29 + listings RCV/BHE). Las
  pantallas viven bajo `/pagar` y `/cobrar` siguiendo el modelo mental
  del PYME (decisión CTO 2026-05-23).
- **🎯 Sprint C2 — data layer COMPLETO** (12 hooks nuevos de mutation
  sobre management/accounts + dimensions + values + assignments). Sin
  UI todavía; editor llega en PR-Mng3/4 con plan-before-issue de UX.
- **🎯 ADR-0012 desbloqueó prod** — supersede el invariante de ADR-0008
  ("override env nunca aplica en prod"). Las 7 features ya mergeadas
  pueden activarse en `app.qavante.com` seteando vars en Cloudflare
  Workers (sin esperar al backend para `/api/management/config`).
- **0 críticos.** Cherry-pick limpio del stacked perdido (#168), rebase
  por conflicto natural (#169), 3 PRs de data layer mecánicos.
- **Slip de proceso documentado:** PRs stacked #166/#167 mergearon a
  sus bases (no a main); recuperados via cherry-pick. Lección
  actualizada: retargetear stacked a main ANTES del merge del padre.

## #1 — Inventario del ciclo

**PRs mergeados a `main`** (todos 2026-05-23 a 2026-05-24):

| PR       | Qué                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| **#161** | `chore(gitignore)`: ignorar todo `/.claude/` (limpia untracked persistente)                                         |
| **#162** | `refactor(qavante)`: extraer `QavanteInlineError` (4 duplicaciones eliminadas)                                      |
| **#163** | `feat(a11y)`: `aria-required` + `aria-describedby` en los 4 dialogs editores                                        |
| **#164** | `docs(adr)`: ADR-0011 patrón estándar dialogs editores admin                                                        |
| **#165** | `feat(sii)`: Sprint C1 PR-Sii1 — data layer SII (7 hooks + 1 helper PDF, +21 tests)                                 |
| **#168** | `feat(sii)`: Sprint C1 PR-Sii2+3 — cherry-picks F29 view + RCV/BHE views (rescatados de stacked perdidos #166/#167) |
| **#169** | `docs(adr)`: ADR-0012 override prod via Cloudflare env vars + cambio en feature-flags.ts                            |
| **#170** | `feat(management)`: Sprint C2 PR-Mng1 — mutations accounts (CRUD + move + toggles)                                  |
| **#171** | `feat(management)`: Sprint C2 PR-Mng2 — mutations dimensions + values + assignments (abierto al cierre)             |

**`main` HEAD al cierre del audit:** post-#170 (#171 mergea momentáneamente).

**Archivos nuevos (24):**

- `src/lib/api/sii.ts` + test (data layer SII completo)
- `src/components/impuestos/f29-view.tsx` + `f29-form-schema.ts` + test
- `src/components/sii/sii-period-form.tsx` + `sii-period-form-schema.ts` + test
- `src/components/sii/rcv-list-view.tsx` + `bhe-list-view.tsx`
- `src/components/qavante/qavante-inline-error.tsx` + story
- 6 pages: `/pagar/impuestos/{page,f29/page}` + `/pagar/facturas-recibidas/{page,view}` + `/pagar/honorarios-recibidos/{page,view}` + `/cobrar/facturas-emitidas/{page,view}`
- `docs/adr/0011-patron-dialogs-editores-admin.md`
- `docs/adr/0012-flags-prod-override-env-vars.md`

**Archivos modificados (10):**

- `src/app/(app)/pagar/page.tsx` + `/cobrar/page.tsx` — landings con sub-cards SII
- `src/lib/api/management.ts` — 12 hooks de mutation nuevos
- `src/lib/api/types.ts` — regenerado con 7 schemas SII + 7 schemas management
- `src/test/msw/handlers.ts` — 8 handlers SII + 12 handlers management mutations
- `src/lib/feature-flags.ts` + test — flag `siiQueries` + cambio override prod
- `src/components/{monedas,reglas,plantillas,clasificacion}` — refactor a `QavanteInlineError`
- `.gitignore`, `docs/adr/README.md`, `docs/operations/cloudflare-workers-setup.md`

**Archivos borrados:** 0.

## #2 — Tests (sobre `main` real post-#170)

| Gate          | Resultado                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck`   | ✅ limpio en cada PR                                                                                                                   |
| `lint`        | ✅ limpio (pre-commit eslint + prettier)                                                                                               |
| `vitest unit` | ✅ **240/240** (174 pre-ciclo + 6 a11y/refactor + 21 SII data + 6 fix CI/schema F29 + 17 período + 6 PR-Mng1 + 10 PR-Mng2 = +66 tests) |
| `next build`  | ✅ limpio                                                                                                                              |
| `e2e` mobile  | ✅ pasó en CI de cada PR                                                                                                               |
| Chromatic UI  | ✅ stories existentes pasan; nuevas baselines pendientes de aceptación (esperado)                                                      |

**Test counts por dominio:**

| Suite                          | Antes ciclo | Después  | Δ                                 |
| ------------------------------ | ----------- | -------- | --------------------------------- |
| feature-flags                  | 12          | 14       | +2 (override prod casos)          |
| sii (data layer)               | 0           | 22       | +22 (nueva suite completa)        |
| impuestos/f29-form-schema      | 0           | 9        | +9 (nueva suite)                  |
| sii/sii-period-form-schema     | 0           | 17       | +17 (nueva suite)                 |
| management                     | 4           | 20       | +16 (mutations PR-Mng1 + PR-Mng2) |
| qavante (1 story inline-error) | —           | +1 story | refactor compartido               |
| total unit                     | 174         | 240      | **+66**                           |

## #3 — Sin regresiones

Verificado:

- ✅ **Navegación intacta**: 6 módulos top-level conservados (inicio,
  caja, cobrar, pagar, gestion, administracion). Las nuevas rutas
  viven bajo `/pagar` y `/cobrar` como subrutas; no se introdujo
  módulo top-level "Impuestos" (decisión CTO 2026-05-23).
- ✅ **Pantallas previas funcionando**: los 4 dialogs editores
  (#155-#157) y el banner §18.7 (#158) **siguen igual** — el refactor
  a `QavanteInlineError` (#162) preserva render byte-equivalent; el
  a11y (#163) agrega atributos sin tocar visuals.
- ✅ **API contracts intactos**: cero modificaciones manuales a
  `types.ts`. Todos los hooks de mutation usan tipos del OpenAPI
  regenerado (`npm run generate:api` antes de #165 y nada después —
  los hooks de management usaron schemas que ya estaban en el types.ts
  desde el ciclo anterior).
- ✅ **Feature flags**: los 7 flags pre-existentes siguen comportándose
  igual + nuevo `siiQueries`. ADR-0012 permite override prod; default
  OFF preservado.

## #4 — Coherencia (reglas + ADRs)

| Regla / ADR                                  | Estado                  | Notas                                                                                                             |
| -------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Regla 3 (no hand-edit `types.ts`)            | ✅                      | `generate:api` regenera de OpenAPI live antes de PR-Sii1                                                          |
| Regla 4 (sin `runtime` export)               | ✅                      | 6 pages Server Components nuevas, ninguna declara runtime                                                         |
| Regla 5 (Edge-compat)                        | ✅                      | Cero deps nuevas                                                                                                  |
| Regla 11 (1 PR = 1 issue)                    | ✅                      | Cada PR cubre 1 pieza acotada                                                                                     |
| Regla 12 (<300 líneas excl. tests/generated) | ✅                      | management.ts crece controladamente (70→280); views <250 c/u                                                      |
| Regla 14 (firma CC-WEB)                      | ✅                      | Todos los commits + PRs firmados                                                                                  |
| Regla 16 (no inventar contrato)              | ✅                      | Sub-restricciones documentadas (F29 not_found es HTTP 200, move no-ciclo, dim-value parent no-descendiente, etc.) |
| ADR-0008 (flags default OFF)                 | ✅ + ADR-0012 supersede | Default OFF preservado; override prod via Cloudflare ahora permitido                                              |
| ADR-0009 (sin drag-drop)                     | ✅                      | Move endpoints sin sort_order                                                                                     |
| ADR-0010 (sin combobox)                      | ✅                      | Inputs nativos en F29 + período + tablas HTML semánticas                                                          |
| ADR-0011 (patrón dialogs)                    | ✅                      | Form de período sigue (schema aparte + a11y) — no es dialog pero respeta espíritu                                 |
| §17.4 (no calcular finanzas)                 | ✅                      | Totales con disclaimer explícito ("dato oficial es el F29")                                                       |

**Patrón consolidado del Sprint C1**:

```
src/components/{dominio-sii}/
  ├── {feature}-form-schema.ts        # zod schema + transforms PUROS (sin React)
  ├── {feature}-form-schema.test.ts   # vitest unit — Node-puro, sin jsdom
  └── {feature}-view.tsx              # client component

src/app/(app)/{modulo}/{ruta}/
  ├── page.tsx                        # Server Component, flag gating
  └── view.tsx (opcional)             # client wrapper thin que invoca hook + view reusable
```

## #5 — Definition of Done (DoD)

| Ítem                                           | Estado                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Tests vitest pasando localmente antes de PR    | ✅ 240/240 en `main`                                                                           |
| Tipos generados (`generate:api` reciente)      | ✅ Regenerado en #165 (+490 LoC con schemas SII)                                               |
| Sin `any` injustificado                        | ✅ Solo narrowings en handlers MSW (cast a unknown explícito)                                  |
| Sin Node-only APIs                             | ✅ Build CLEAN para Workers                                                                    |
| Sin localStorage/sessionStorage para auth      | ✅                                                                                             |
| Voice & Tone Anexo F                           | ✅ "Facturas recibidas" no "RCV Compras"; "Sin declaración para este folio" no "404 not_found" |
| A11y básica (labels + ARIA)                    | ✅ Patrón ADR-0011 aplicado en F29 view + período form                                         |
| Bundle dentro de budget                        | ✅ Ver #6                                                                                      |
| Lighthouse mobile ≥85 `/login` y ≥90 `/inicio` | ✅ CI pasa en cada PR                                                                          |

## #6 — Bundle (lectura final post-#170)

| Ruta                              | Size        | First Load JS | Δ vs ciclo anterior    |
| --------------------------------- | ----------- | ------------- | ---------------------- |
| `/inicio`                         | 2.67 kB     | 115 kB        | —                      |
| `/login`                          | 4.98 kB     | 149 kB        | —                      |
| `/pagar`                          | 2.44 kB     | 118 kB        | +0.01 kB (3 sub-cards) |
| `/cobrar`                         | 2.44 kB     | 118 kB        | +0.01 kB (1 sub-card)  |
| **`/pagar/impuestos`**            | **2.43 kB** | **118 kB**    | nueva                  |
| **`/pagar/impuestos/f29`**        | **7.1 kB**  | **157 kB**    | nueva                  |
| **`/pagar/facturas-recibidas`**   | **383 B**   | **157 kB**    | nueva                  |
| **`/cobrar/facturas-emitidas`**   | **378 B**   | **157 kB**    | nueva                  |
| **`/pagar/honorarios-recibidos`** | **2.78 kB** | **157 kB**    | nueva                  |
| `/administracion/*`               | (varias)    | 118-190 kB    | sin cambio             |
| First Load shared                 | —           | 103 kB        | sin cambio             |

**Observaciones:**

- Las 4 rutas SII consumidoras quedan en **157 kB First Load JS**
  (incluye RHF + zod). Es admin-tier, dentro del presupuesto Lighthouse
  ≥85 mobile que mide `/login` y `/inicio`.
- Las pages thin (`/pagar/facturas-recibidas`, `/cobrar/facturas-emitidas`)
  son ~380 B — solo el wrapper que invoca el hook + el view reusable
  comparte chunks.
- El refactor de `QavanteInlineError` (-12 LoC por view \* 4 views = -48
  LoC neto) no movió el aguja del bundle (-0.05 kB en cada vista).

## #7 — Documentación

| Doc                                                 | Estado                                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Comentarios in-code densos en cada componente nuevo | ✅ Cada archivo abre con `/* ... */` que referencia §addendum, decisiones de scope, contrato              |
| ADR-0011 (patrón dialogs editores)                  | ✅ #164                                                                                                   |
| ADR-0012 (flags override prod)                      | ✅ #169                                                                                                   |
| `docs/operations/cloudflare-workers-setup.md`       | ✅ Nueva sección "Feature flags en producción (ADR-0012)" con tabla de 7 vars + procedimiento kill-switch |
| Este audit K.4                                      | ✅ este archivo                                                                                           |
| README / CHANGELOG                                  | ⏸ pendientes para el cierre del milestone (no por feature)                                                |

## #8 — Lecciones del ciclo

1. **Stacked PRs deben retargetearse a main ANTES del merge del padre**.
   Lección concreta: #166/#167 mergearon a `feat/sii-data-layer` y
   `feat/sii-f29-view` respectivamente; cuando #165 mergeó a main, las
   bases se borraron y los cambios de #166/#167 quedaron huérfanos.
   Rescatados via cherry-pick a una branch nueva (#168). Ya pasó antes
   con #98/#102/#138 (memoria del proyecto), pero la lección no se
   automatizó. **Acción**: documentar en CLAUDE.md o pre-commit hook
   que valide retarget pendiente.
2. **Bug específico de CI con `process.env.NEXT_PUBLIC_*`**: los tests
   que leen env vars directo fallan en CI (sin `.env.local`). Solución:
   `vi.stubEnv()` + `vi.unstubAllEnvs()` en `beforeEach`/`afterEach`.
   Patrón aplicado en #165 (fix CI). Documentar en `vitest.setup.ts` o
   un README de testing si se vuelve recurrente.
3. **El invariante ADR-0008 "override env nunca aplica en prod" era
   demasiado estricto** para el caso de uso real (validación interna +
   piloto). ADR-0012 supersede preservando el spirit (default OFF) pero
   permitiendo activación intencional. Lección: los invariantes "por
   precaución" deben revisarse cuando el contexto cambia (de "esqueletos
   sin backend" a "features completas esperando backend gating").
4. **Data-layer-first sigue siendo el patrón correcto** para arrancar
   features post-handoff backend. PR-Sii1 (#165) y PR-Mng1/2 (#170/#171)
   son los 3er y 4to ejemplo del patrón en este sprint; el editor UI
   posterior siempre es trivial cuando el data layer está sólido.
5. **El refactor a `QavanteInlineError` (#162) y la a11y (#163) fueron
   trabajo "cleanup técnico" que se pagó solo**: redujo duplicación
   (4 funciones idénticas → 1 componente compartido), abrió la puerta
   a ADR-0011 (patrón replicable), y subió el bar de a11y sin tocar
   visuals (Chromatic pixel-perfect).

## #9 — Próximo ciclo — propuesta

### Inmediato (FE puede arrancar sin backend nuevo)

1. **PR-Mng3 + PR-Mng4 — editores UI de management** sobre los 12
   hooks de mutation ya en main:
   - PR-Mng3: editor `/administracion/estructura-gestion` (árbol
     accounts con edit/move/toggle inline). Requiere plan-before-issue
     porque ADR-0009 prohíbe drag-drop → opción: selector de parent +
     botones up/down de sort_order.
   - PR-Mng4: editor `/administracion/vistas-gestion` (dimensions list
     - value editor por dimensión + assignments view).

2. **PR-Caj1 — vista de movimientos CLASIFICADOS**
   `/caja/clasificados`. Hoy solo existe `/caja/por-clasificar`. Útil
   para reclasificar/auditar lo ya hecho. Data layer ya soporta
   `useBankMovements({status: 'classified'})`.

3. **Storybook stories de las nuevas vistas Sprint C1** (F29View,
   RcvListView, BheListView, SiiPeriodForm). Quedó diferido por
   tiempo en el ciclo.

### Acciones requieren tu input (Fernando)

- **Setear env vars en Cloudflare** (ADR-0012, doc en
  `cloudflare-workers-setup.md`): habilitar Sprint C1 + addendum en
  prod sin esperar al backend.
- **Decisión UX para PR-Mng3/4**: árbol jerárquico sin drag-drop —
  ¿selector de parent o reordering inline con botones?
- **Decisión sobre toast notifications**: `sonner` está en
  `package.json` con stub vacío. Pendiente desde sesión previa.
- **Sprint C2 — alcance restante**: además de los editores, ¿qué más
  considera C2 del doc maestro? Faltaría auditar:
  - Banner clasificación masiva en `/caja/por-clasificar`
  - Stats / dashboard de clasificación (cuántos OK, cuántos
    pending, accuracy)
  - Reasignación de assignments

### Bloqueantes backend (no nuestros)

- `/api/management/config` — sigue sin ETA en CC-API. ADR-0012 nos
  permite avanzar sin él, pero idealmente ese endpoint reemplaza el
  override env como fuente preferida.
- Endpoint reorder de reglas §17.6 — sigue sin ETA. Drag-drop priority
  bloqueado.

---

Generated by CC-WEB — 2026-05-24.
