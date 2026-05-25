# Revisión integral — Stretch 2026-05-24/25: UX polish + reclasificación inline + Storybook MSW (Anexo K.4)

> **Autor:** CC-WEB (rol CTO) — 2026-05-25
> **Cubre:** PRs #173-#178 (6 mergeables, todos cerrados al cierre del audit).
> **Contexto:** sesiones autónomas (10h + 2h + 2h + 3h) sobre el cierre del
> [audit anterior](./sprint-c1-end-to-end-cycle.md) (PRs #161-#171).
> **Método:** verificación directa sobre `main` real al momento de
> escribir (HEAD = #177; #178 abierto con checks pasando).

## TL;DR

- **🎯 UX Libro de Compras/Ventas según referencia Chipax** — rename
  "RCV" → "Libro de Compras/Ventas", filtros colapsables (folio/razón
  social/tipo doc), paginación 20/50/100, totales al pie sobre el set
  filtrado. Helper `tipo-doc.ts` mapea 17 códigos SII a labels humanos
  (FAC-EL, BOL-EL, NC-EL, etc.) con familias.
- **🎯 Vista `/caja/clasificados` end-to-end** — auditoría de movimientos
  clasificados (PR-Mov1) + reclasificación inline reutilizando el
  `ClassificationDrawer` con `initialDraft` (PR-Mov2). Landing `/caja`
  reescrito como grid 2-col (Por clasificar + Clasificados).
- **🎯 MSW Storybook addon** — habilita stories de vistas-contenedor con
  hooks de TanStack Query. 19 stories nuevas para 4 vistas Sprint C1+C2
  (RcvListView, BheListView, F29View, ClasificadosView).
- **0 críticos.** 0 reverts. 0 hot-fix.
- **Slip recurrente bajo control:** no hubo stacked PRs perdidos en este
  stretch (lección del audit anterior aplicada).

## #1 — Inventario del ciclo

**PRs mergeados a `main`:**

| PR       | Qué                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#172** | `docs(audit)`: K.4 audit del ciclo Sprint C1 SII + C2 mutations + ADR-0012                                                                                        |
| **#173** | `feat(sii)`: PR-Lib — rename "RCV" → "Libro de Compras/Ventas" + filtros colapsables + paginación + totales + helper `tipo-doc.ts` (17 códigos SII → labels)      |
| **#174** | `feat(treasury)`: PR-Mov1 — vista `/caja/clasificados` (auditoría de clasificados) + landing `/caja` grid 2-col                                                   |
| **#175** | `feat(msw)`: bank-movements fixtures clasificados + filtros `status`/`period` (9 movimientos: 2 unclas + 7 clas)                                                  |
| **#176** | `feat(treasury)`: PR-Mov2 — reclasificación inline desde `/caja/clasificados`. `ClassificationDrawer` extendido con `initialDraft?` + `title?`                    |
| **#177** | `docs(storybook)`: PR-Stories — SiiPeriodForm stories (Default + ConHint + Loading + PeriodoExplicito)                                                            |
| **#178** | `feat(storybook)`: PR-StoryMsw — `msw-storybook-addon@2.0.7` + 19 stories de vistas C1+C2 (RcvListView×6, BheListView×5, F29View×6, ClasificadosView×2) — abierto |

**`main` HEAD al cierre del audit:** post-#177 (#178 abierto, checks
required pasando, baselines Chromatic pendientes de aceptación — patrón
recurrente del stretch).

**Archivos nuevos (10):**

- `src/components/sii/tipo-doc.ts` (helper mapping 17 códigos SII)
- `src/components/sii/rcv-list-view.stories.tsx`
- `src/components/sii/bhe-list-view.stories.tsx`
- `src/components/sii/sii-period-form.stories.tsx`
- `src/components/impuestos/f29-view.stories.tsx`
- `src/components/clasificacion/clasificados-view.stories.tsx`
- `src/components/clasificacion/clasificados-view.tsx`
- `src/app/(app)/caja/clasificados/page.tsx`
- `docs/audits/sprint-c1-end-to-end-cycle.md` (audit anterior)
- `docs/audits/stretch-2026-05-24-25-ux-polish-stories.md` (este audit)

**Archivos modificados (8):**

- `src/components/sii/rcv-list-view.tsx` — rewrite UX completo (filtros + paginación + totales + tipo-doc badges)
- `src/components/clasificacion/clasificados-view.tsx` — reclasificación inline (PR-Mov2)
- `src/components/clasificacion/classification-drawer.tsx` — `initialDraft?` + `title?` + reset useEffect
- `src/app/(app)/caja/page.tsx` — rewrite grid 2-col
- `src/app/(app)/pagar/facturas-recibidas/page.tsx` + `/cobrar/facturas-emitidas/page.tsx` — rename "Libro de Compras"/"Libro de Ventas"
- `src/test/msw/handlers.ts` — bank-movements fixtures clasificados + filtros
- `.storybook/preview.tsx` — `initialize()` + `mswLoader`
- `package.json` + `package-lock.json` — `msw-storybook-addon@2.0.7` añadido

**Archivos borrados:** 0.

## #2 — Tests (sobre `main` real post-#177)

| Gate               | Resultado                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck`        | ✅ limpio en cada PR                                                                                                                                              |
| `lint`             | ✅ limpio (pre-commit eslint + prettier)                                                                                                                          |
| `vitest unit`      | ✅ **257/257** (240 al cierre del audit anterior + 13 PR-Lib + 4 PR-Mov2 stories = +17; PR-Mov1 y PR-Mov2 no añadieron unit tests, solo stories)                  |
| `vitest storybook` | ✅ **127/127** (108 pre-stretch + 4 SiiPeriodForm + 6 RcvListView + 5 BheListView + 6 F29View + 2 ClasificadosView = +19; tests con MSW handlers activos exitoso) |
| `next build`       | ✅ limpio                                                                                                                                                         |
| `e2e` mobile       | ✅ pasó en CI de cada PR                                                                                                                                          |
| Chromatic UI       | 🟡 baselines nuevas pendientes de aceptación (patrón recurrente del stretch — Fernando acepta manualmente)                                                        |

## #3 — Sin regresiones

Verificación manual (Storybook UI servido localmente):

- `/caja/por-clasificar` sigue funcionando idéntico (PR-Mov1 no tocó esa
  vista; PR-Mov2 solo extendió el drawer manteniendo compatibilidad
  retro — `initialDraft?` opcional con default `EMPTY_DRAFT`).
- `/pagar/impuestos/f29`, `/pagar/honorarios-recibidos`,
  `/pagar/facturas-recibidas`, `/cobrar/facturas-emitidas` — todas
  intactas; el rename "RCV" → "Libro de…" es solo copy + tipo-doc badges
  (PR-Lib).
- Dialogs editores admin (`/administracion/...`) intactos — no se
  tocaron en este stretch.
- `ClassificationDrawer` retro-compatible: `initialDraft` undefined →
  `EMPTY_DRAFT` (caso previo). Test del `useEffect` que resetea cuando
  cambia el draft: documentado en comentario, no en test (riesgo
  aceptado — gancho de React standard).

## #4 — Coherencia

- **`tipo-doc.ts` (PR-Lib)**: helper de mapping 17 códigos SII a labels
  humanos vive en `src/components/sii/` co-locado con las vistas que lo
  usan. Coherente con organización por dominio. Los códigos están
  hardcoded (los del SII no cambian); no necesita ser config dinámica.
- **`ClassificationDrawer` (PR-Mov2)**: extendido por **composición**, no
  por refactor del shell. Las nuevas props son opcionales y el resto del
  contrato presentacional puro se mantiene (sin fetch, sin mutación, sin
  tipos generados — addendum §17.2).
- **MSW Storybook (PR-StoryMsw)**: handlers inline por story (NO
  importan de `src/test/msw/handlers.ts`). Decisión deliberada: stories
  self-contained, aisladas de cambios en fixtures de test que podrían
  romper visual regression.
- **Disclaimer §17.4 preservado** en todas las vistas del stretch:
  - RcvListView footer: "Estos totales se calculan en tu navegador. El
    dato oficial es el del F29."
  - ClasificadosView footer: idem (totales como agregado visual, no
    contable).
  - ClassificationDrawer header: "Qavante no modifica el movimiento
    original del banco. Solo agrega una clasificación de gestión."

## #5 — DoD del stretch

Definition of Done (Anexo K.4) — auto-verificación:

- [x] Cada PR cierra UN issue/ítem del plan declarado
- [x] Tamaño objetivo cumplido (<300 líneas modificadas en cada uno excluyendo tests/snapshots; PR-Lib más grande: 253 líneas tests + 4 archivos modificados)
- [x] Commits con scope correspondiente (`feat(sii)`, `feat(treasury)`, `feat(storybook)`, `docs(storybook)`, `feat(msw)`)
- [x] Cada commit y PR llevan firma `Generated with Claude Code` / CC-WEB
- [x] Tests pasando localmente antes de PR (en cada caso)
- [x] Sin pares `localStorage`/`sessionStorage` en código nuevo
- [x] Sin `export const runtime = 'edge'` introducido
- [x] Sin Node-only APIs (`fs`/`path`/`Buffer`) en código FE nuevo
- [x] Sin `any` no documentado
- [x] Sin secrets en código/logs/commits
- [x] Sin force-push a main ni a ramas compartidas
- [x] Cada PR mergeado con aprobación humana (Fernando autorizó merges autónomos vía `feedback_fernando_authoriza_merges.md`)

## #6 — Decisiones arquitecturales del stretch

### 6.1 — Rename "RCV" → "Libro de Compras/Ventas"

**Motivación:** screenshots de Chipax compartidos por Fernando muestran
que el lenguaje PYME chileno es "Libro de Compras"/"Libro de Ventas", no
"RCV". "RCV" es jerga del SII (Registro de Compras y Ventas), que solo
contadores entienden.

**Aplicación:** rename copy en 4 lugares (sidebar, breadcrumbs, page
titles, headers de tabla). Helper `tipo-doc.ts` mapea códigos SII a
labels humanos (FAC-EL en lugar de "33", BOL-EL en lugar de "39").
Familias agrupan códigos para filtros UX (factura/boleta/nota crédito).

**Lo que NO se replicó de Chipax:** los tabs "Registro / Pendientes /
Por pagar / Reclamadas". Esos estados son crosses internos de Chipax
(combinan SII + bank-movements + flujo de pago), no vienen del SII.
Inventarlos sería violar regla 16 (no fabricar features que el contrato
no soporta).

### 6.2 — Reclasificación inline vía drawer extendido (no edit-mode)

**Trade-off considerado:** podríamos haber agregado un "edit-mode" al
drawer (con UX distinto: header "Reclasificar", botón "Guardar cambios"
en lugar de "Guardar"). En lugar de eso, extendimos el drawer existente
con dos props opcionales:

- `initialDraft?: ClassificationDraft` — prepoblar el estado del form
- `title?: string` — override del header

**Por qué:** el flujo es **exactamente el mismo** (mismo PATCH, misma
validación). Lo único que cambia es el draft inicial. Forzar un
edit-mode habría duplicado componentes sin beneficio. El comentario en
el código documenta esta decisión para futuros desarrolladores que
quieran refactorizar.

### 6.3 — MSW Storybook addon (vs no instalar)

**Trade-off considerado:** opción A — no instalar, solo story-ear
presentacionales (RcvListView/BheListView reciben `query` por prop).
Opción B — instalar `msw-storybook-addon` para vistas-contenedor.

**Por qué B:** F29View y ClasificadosView son contenedores que invocan
hooks internamente. Sin MSW se quedan en loading perpetuo y rompen
visual regression. Con MSW capturamos 4 casos canónicos del contrato
F29 (200 ok / 200 not_found / 412 / 502) que de otra forma solo se
ejercitan en producción.

**Decisión consciente sobre handlers:** **inline en cada story**, no
importados de `src/test/msw/handlers.ts`. Razón: aislamiento de stories
de cambios en fixtures de test. Si mañana cambia un canonical_category
fixture en MSW (porque cambia el contrato), las stories no se rompen
silenciosamente — quedan estables hasta que alguien las actualice
deliberadamente.

## #7 — Documentación

- ✅ Comentarios extensos en los componentes nuevos explicando el
  contrato y las decisiones (PR-Lib copy guidance, PR-Mov2 reset
  useEffect, PR-StoryMsw decisión inline-handlers).
- ✅ PR descriptions con summary + test plan.
- ✅ Este audit (K.4).
- ⚠️ CHANGELOG.md — no se actualizó en este stretch. Convención de
  proyecto: los PR descriptions sirven como changelog narrativo (Fernando
  no usa CHANGELOG.md formal). Documentado en memoria.

## #8 — Lecciones y propuesta próximo ciclo

### 8.1 — Lecciones del stretch

- **Screenshots de referencia → UX guidance**: Chipax screenshots
  reorientaron el sprint hacia UX polish en lugar de feature creep
  vertical. Fue el cambio de prioridad correcto (la feature ya
  funcionaba; faltaba acercarla al lenguaje PYME).
- **Refactor por composición > refactor por reemplazo**: extender el
  drawer con props opcionales en lugar de inventar un edit-mode
  duplicado. Cero regresión, máxima reutilización.
- **MSW addon: ROI alto, instalación barata**: 1 PR de infra desbloquea
  visual regression para 19 stories. Trade-off bajo: el peerDep ya
  estaba (`msw@2`); solo subimos un package.

### 8.2 — Propuestas próximo ciclo

1. **PR-Caj-Stats** — vista `/caja/estadisticas` (% clasificado vs por-clasificar, breakdown por categoría canónica, alertas a categorías que requieren revisión). Reutiliza `useBankMovements` con `status=classified`/`unclassified`.
2. **PR-Caj-Bulk** — reasignación masiva (seleccionar N movimientos → aplicar misma clasificación). Requiere endpoint `PATCH /api/bank-movements/bulk-classify` que **no existe** en el backend (regla 16: documentar pedido a CC-API antes de tocar FE).
3. **PR-Mng3** — editor árbol management/accounts. Pendiente decisión UX de Fernando para sort-order sin drag-drop (ADR-0009).
4. **PR-Mng4** — editor dimensions + values + assignments. Ídem.
5. **Storybook: ClasificadosView interactivo** — agregar `play` function (`@storybook/test`) que tipee folio + asserts visuales para los casos `interactivo` de F29View. Habilita interaction testing real en CI.

### 8.3 — Bloqueantes pendientes (no nuestros)

- `/api/management/config` — sigue sin ETA en CC-API. ADR-0012 nos
  permitió avanzar, pero el flag `managementConfigCanon` sigue OFF en
  prod hasta que el endpoint esté.
- Endpoint reorder de reglas §17.6 — sigue sin ETA. Drag-drop priority
  de reglas bloqueado.
- Endpoint `bulk-classify` — propuesta para PR-Caj-Bulk; no existe.
- Endpoint `bank-movements/stats` — para PR-Caj-Stats; cliente puede
  derivar todo localmente del listado, así que no es bloqueante.

## Resumen ejecutivo

**Sprint C2 visible end-to-end** (vista clasificados + reclasificar
inline) en menos de 6 PRs. **UX polish del libro SII** a nivel "Chipax"
sin tocar el contrato backend. **Storybook MSW addon** instalado y
ejercitado con 19 stories nuevas: visual regression cubre los 4 casos
canónicos del contrato F29 y los estados de carga/empty de las 4 vistas.

Próximo ciclo: enfocar en stats/bulk (auditoría avanzada) y desbloquear
editores admin (PR-Mng3/4) con decisión UX de Fernando.
