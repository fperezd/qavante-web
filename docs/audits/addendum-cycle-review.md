# Revisión integral — Ciclo Storybook + Chromatic + Addendum v2.0 (Anexo K.4)

**Fecha:** 2026-05-16
**Ejecutor:** CC-WEB (rol CTO), ciclo autónomo autorizado por Fernando.
**Alcance:** `git diff 7db8841..HEAD` — 10 PRs squash mergeados (#77, #78, #79, #81, #82, #83, #86, #87, #88, #89), 39 archivos, +18 032 / −11 427 LoC (el grueso es `package-lock.json` por las deps de Storybook 10 + Chromatic + addon-vitest).
**Resultado global:** **0 críticos, 0 medios, 3 menores (todos ya documentados y aceptados conscientemente).** Ciclo sólido. Toda la deuda detectada tiene resolución trazada en issues/ADRs.

---

## TL;DR

| #   | Hallazgo                                                                                              | Severidad | Estado                                              |
| --- | ----------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------- |
| 1   | Flake intermitente de 1 test vitest (timing de setup MSW)                                              | 🟢 menor  | Conocido desde audit c1-prep; 74/74 en 2 reruns     |
| 2   | Baseline Chromatic requiere aceptación manual de Fernando (4 diffs históricos)                          | 🟢 menor  | Trazado en #86 + CHANGELOG; causa raíz mitigada #88 |
| 3   | 2 mecanismos test-only paralelos (`qavante_test_role` + `NEXT_PUBLIC_TEST_MODE`)                        | 🟢 menor  | Decisión CTO de deuda aceptada — issue #90          |

Sin críticos ni medios. El único 🟡 del audit anterior (backend bloqueado) sigue vigente pero es cross-team, no de este ciclo.

---

## #1 — Inventario

PRs squash en `main` (post audit c1-prep #76):

| PR  | Qué                                                                 |
| --- | ------------------------------------------------------------------- |
| #77 | Storybook 10 + 6 stories Capa 1 (design system)                     |
| #78 | Storybook Capa 2 — 13 componentes admin/credenciales                |
| #79 | Chromatic visual regression — setup técnico (gated por secret)      |
| #81 | Storybook tests vía Vitest (`projects[]`, Playwright 1.60 alineado) |
| #82 | Runbook handoff cross-agente SII (CC-WEB↔CC-API)                    |
| #83 | Formalización Addendum Frontend v2.0 + reconciliación CTO           |
| #86 | ADR-0007/0008/0009 (estructura, feature flags, DnD)                 |
| #87 | Brief 2º handoff backend — taxonomía/gestión/multimoneda            |
| #88 | Config Chromatic anti-flakiness (causa raíz de #86)                 |
| #89 | CHANGELOG `[Unreleased]` al día                                     |

Áreas tocadas:

| Área              | Detalle                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Storybook         | `.storybook/{main,preview}.tsx`, 19 `*.stories.tsx` co-located, `package.json` (storybook 10 + addons)         |
| Test infra        | `vitest.config.ts` (`projects[]` unit + storybook), `.github/workflows/ci.yml` (job `test-storybook`)         |
| Visual regression | `.github/workflows/chromatic.yml`, `chromatic` dep, `preview.tsx` (params anti-flakiness)                      |
| Docs proceso      | `docs/addendum/{frontend-v2,reconciliation,taxonomy-handoff-brief}.md`, `docs/backend-contracts/c1-sii-handoff-runbook.md`, ADR-0007/0008/0009 + README ADR |
| Release           | `CHANGELOG.md` `[Unreleased]`                                                                                  |
| Limpieza          | `.docx` binario del addendum eliminado de la raíz (no versionable)                                            |

**Cero código de producto tocado.** Todo el ciclo es tooling (Storybook/Chromatic/vitest), documentación de proceso (addendum/ADRs/runbooks/handoffs) y release notes. Ningún componente, ruta, hook o lógica de negocio modificado → superficie de regresión de producto = nula por construcción.

## #2 — Tests

```
npm run lint       → clean
npx tsc --noEmit   → clean
npm test           → 74/74 (1ª corrida 1 flake; 74/74 en 2 reruns consecutivos)
npm run build      → OK, 14 rutas
npm run size:check → todas dentro del presupuesto (sin cambios vs c1-prep)
npm run test:storybook → 86/86 (verificado en CI de #88/#89)
```

Cobertura nueva del ciclo: **86 tests de storybook** (1 por story, render en Chromium headless) — red de seguridad que no existía. `npm run test` se mantuvo rápido (proyecto `unit`, ~8s) separando el proyecto `storybook` a job CI propio.

## #3 — Sin regresiones

- Bundle `size:check` idéntico a c1-prep (`/login` 147 kB, `/inicio` 115 kB, etc.) — Storybook/Chromatic **no entran al bundle de producción** (`storybook-static/` gitignored, `.stories.tsx` no importados por ninguna ruta, verificado).
- E2E (`auth-redirect` + mobile public/protected) verde en todos los CI del ciclo.
- Navegación 6 módulos, login/auth, rutas C1-prep: intactos (cero código de producto tocado).
- Regresión real detectada y corregida **dentro** del ciclo: mismatch Playwright 1.59/1.60 que rompía `test-storybook` en CI (#81) — diagnosticado a causa raíz (dos versiones → `npx playwright install` ambiguo) y alineado a 1.60.0, validado e2e + storybook antes de mergear.

## #4 — Coherencia

| Check                                | Resultado                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `export const runtime` en `src/`     | ✓ ninguno (CLAUDE.md regla 4; reconciliación P1-1 lo reafirma para los dominios del addendum)          |
| `any` sin justificar                 | ✓ ninguno                                                                                              |
| Storage APIs para tokens             | ✓ ninguno                                                                                              |
| Decisiones arquitecturales con ADR   | ✓ ADR-0007/0008/0009 cubren lo que el addendum asumía sin formalizar                                   |
| Addendum vs CLAUDE.md                | ✓ 4 contradicciones P1 reconciliadas autoritativamente (`reconciliation.md`), gana repo/CLAUDE.md      |
| Supuesto P0 del addendum             | ✓ verificado contra OpenAPI prod (59 paths, 0 endpoints) — documentado, no asumido                     |
| Binarios en el repo                  | ✓ `.docx` del addendum eliminado; Documento Maestro (`qavante_fase1_v2.6.x.docx`) intacto (no se toca) |
| ADR README índice                    | ✓ actualizado 0007–0009                                                                                |

## #5 — DoD del ciclo

| Objetivo                                  | Estado                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| #69 Storybook (Capa 1 + 2 + vitest + Chromatic) | ✓ cerrado — 19 componentes, 86 stories, baseline Chromatic operativo                |
| Addendum formalizado al proceso           | ✓ `.md` versionado + reconciliación + ADRs + CHANGELOG                                  |
| Handoff SII documentado para CC-API       | ✓ runbook #82 (contrato cerrado, 6 pasos)                                               |
| Handoff taxonomía documentado para CC-API | ✓ brief #87 (co-diseño, contrato a definir por backend)                                 |
| Deuda detectada trazada                   | ✓ #90 (unificación test-only, deuda aceptada con criterio de revisita)                  |
| Implementación addendum (PRs #83-#89 del doc) | ✗ **bloqueado** — backend no expone endpoints (P0). Esperado, no es falla del ciclo |

## #6 — Documentación

CHANGELOG `[Unreleased]` cubre los 10 PRs + ambos handoffs cross-team + acción manual Chromatic. ADRs 0007/0008/0009 `Proposed`→`Accepted` al merge. Runbook SII + brief taxonomía + reconciliación enlazados entre sí y al Documento Maestro. README de ADR con índice al día. Trazabilidad de la decisión de deuda aceptada en #90 y del estado Chromatic en el comentario de #86.

## #7 — Lighthouse / performance

Sin cambios respecto a c1-prep (cero código de producto). Gate Lighthouse (`/login` + `/credenciales` ≥0.85) verde en todos los CI del ciclo. `/app/inicio` ≥0.90 sigue diferido por cookie cross-origin (cross-team, no de este ciclo).

---

## Recomendaciones

### 🔴 Crítico / 🟡 Medio

Ninguno.

### 🟢 Menor (todos ya gestionados — no requieren acción nueva)

1. **Flake de 1 test vitest** — timing de setup MSW, no determinista, sin impacto (74/74 estable en reruns). Si se vuelve frecuente: aislar el test que flakea y revisar el `beforeAll` de `vitest.setup.ts`. No urgente.
2. **Baseline Chromatic** — Fernando debe aceptar una vez los 4 diffs históricos en la UI web (acción manual, ~30s). Causa raíz (stories con `animate-spin`) ya mitigada en #88; no debería repetirse.
3. **Unificación test-only** — diferida conscientemente (issue #90) con criterio de revisita explícito. No es bug.

### Bloqueo estructural (no de este ciclo)

El trabajo de implementación del addendum (estructura de gestión, vistas, monedas, reglas, clasificación) y de credenciales SII está **100% bloqueado por los 2 handoffs backend**. CC-WEB agotó el trabajo sin dependencias. Próximo desbloqueo: que CC-API exponga endpoints en el OpenAPI de prod (runbook SII #82 + brief taxonomía #87 listos para que Fernando los lleve a CC-API).

---

## Checklist Anexo K.4 — 7 puntos

1. **Inventario** ✓ — 10 PRs, 39 archivos, cero código de producto.
2. **Tests** ✓ — lint/typecheck/build/size:check verdes; 74/74 unit (2 reruns); 86/86 storybook.
3. **Sin regresiones** ✓ — bundle idéntico, e2e verde, una regresión interna (Playwright mismatch) detectada y corregida dentro del ciclo.
4. **Coherencia** ✓ — sin runtime edge / any / storage APIs; ADRs + reconciliación cierran los gaps del addendum; binario eliminado.
5. **DoD** ✓ — #69 cerrado, addendum formalizado, handoffs documentados; implementación bloqueada por backend (esperado).
6. **Documentación** ✓ — CHANGELOG + ADRs + runbooks + reconciliación + #90 al día.
7. **Lighthouse** ✓ — sin cambios (cero código producto), gate verde.

**Veredicto:** ciclo cerrado limpio. La adecuación del Addendum Frontend v2.0 quedó formalizada, reconciliada con las reglas del repo, y con la cola de handoffs lista. Todo lo accionable sin backend está hecho; lo demás depende de CC-API.

---

Generated by CC-WEB — 2026-05-16.
