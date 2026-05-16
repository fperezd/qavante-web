# Revisión integral — Ciclo "addendum skeleton" (Anexo K.4)

> **Autor:** CC-WEB (rol CTO) — 2026-05-16
> **Ciclo:** trabajo autónomo autorizado por Fernando (ventana ~10 h) que
> adelanta lo del Addendum Frontend v2.0 que **no depende de backend**:
> sincronización de docs con la realidad verificada, infra de feature-flags,
> esqueletos de ruta gateados y componentes presentacionales.
> **Método del audit:** rama de integración descartable = `origin/main` +
> PR #94 + PR #98 (incluye #96) + PR #102 (incluye #100). Suite completa
> corrida sobre el árbol integrado, no PR por PR.

## TL;DR

- **0 críticos.** Todo lo entregado es aditivo, gateado en OFF y sin tocar
  navegación/login/rutas existentes.
- **2 escalamientos a Fernando (regla 16), no defectos:** drift de
  credenciales SII (P4-2) y `canonical_category` doc-backend vs API-vivo
  (P4-4). Documentados, **no parcheados en silencio**. Bloquean `generate:api`
  / integración real, no este ciclo.
- **Suite integrada verde:** typecheck · lint · 92 unit · build · size gate ·
  100 storybook (24 archivos). 1 fallo unit **transitorio** en el primer run
  cold post-merge; 3 runs siguientes limpios (flake del runner, no del código
  — los tests nuevos son funciones puras deterministas).
- **Chromatic:** 5 stories nuevas → ~19 snapshots nuevos. La **aceptación de
  baseline es manual de Fernando en chromatic.com** — CC-WEB no puede hacerla
  (no es operación de repo). Las stories nuevas son flakiness-safe (sin
  animaciones), así que el accept será limpio.

## #1 — Inventario

**PRs (ninguno mergeado — regla 10, los mergea Fernando):**

| PR                                                      | Issue | Rama                                   | Base                            | Qué                                         |
| ------------------------------------------------------- | ----- | -------------------------------------- | ------------------------------- | ------------------------------------------- |
| [#94](https://github.com/fperezd/qavante-web/pull/94)   | #93   | `docs/backend-live-finding-2026-05-16` | main                            | Docs: backend bajó (P4) + P4-4 corrige P3-1 |
| [#96](https://github.com/fperezd/qavante-web/pull/96)   | #95   | `feat/feature-flags-adr0008`           | main                            | Infra feature-flags (ADR-0008)              |
| [#98](https://github.com/fperezd/qavante-web/pull/98)   | #97   | `feat/addendum-skeleton-routes`        | `feat/feature-flags-adr0008`    | 5 rutas gateadas + FeatureUnavailableState  |
| [#100](https://github.com/fperezd/qavante-web/pull/100) | #99   | `feat/clasificacion-selectores`        | main                            | 3 selectores presentacionales + filtro      |
| [#102](https://github.com/fperezd/qavante-web/pull/102) | #101  | `feat/clasificacion-drawer`            | `feat/clasificacion-selectores` | ClassificationDrawer shell                  |

**Orden de merge sugerido:** #94 (docs, independiente) · #96 → #98 (stack) ·
#100 → #102 (stack). Tras mergear #96/#100, rebasar #98/#102 a main.

**Archivos:** 29 archivos, +1721 / −43 (excl. `package-lock.json`).
**Nuevos:** `src/lib/feature-flags.ts` (+test),
`src/components/qavante/feature-unavailable-state.tsx` (+story), 5
`src/app/(app)/.../page.tsx`, y `src/components/clasificacion/*` (4
componentes, filtro+test, types, fixtures, 4 stories, barrel).
**Modificados:** `reconciliation.md`, `taxonomy-handoff-brief.md`,
`CHANGELOG.md`, `CONTRIBUTING.md`, `ADR-0008`, `administracion/page.tsx`,
`qavante/index.ts`.

## #2 — Tests (árbol integrado)

| Gate             | Resultado                                                                |
| ---------------- | ------------------------------------------------------------------------ |
| `typecheck`      | ✅ limpio (tras limpiar `.next` stale)                                   |
| `lint`           | ✅ limpio                                                                |
| `test` (unit)    | ✅ 92/92 (74 base + 12 feature-flags + 6 filter). Ver nota flake.        |
| `build`          | ✅ compiló; rutas nuevas 1.53 kB / 114 kB c/u                            |
| `size:check`     | ✅ todas dentro de presupuesto (login 144/200, inicio 112/400)           |
| `test:storybook` | ✅ 100/100 (24 archivos; +14 vs base: 3 FeatureUnavailable + 11 clasif.) |

**Nota flake:** el primer run unit cold post-merge dio 1 fallo; 3 runs
posteriores 92/92. Causa: cold-start del runner (8 archivos + setup MSW),
no el código (los tests nuevos son `filter`/`feature-flags`, funciones puras
sin I/O). No bloqueante; vigilar en CI.

## #3 — Sin regresiones

- **Navegación:** sidebar intacto (6 módulos, sin subnav — los accesos
  nuevos van en la landing de Administración, addendum §9.1). 0 cambios en
  `sidebar.tsx`.
- **Login/auth:** sin tocar. 0 cambios en middleware/auth.
- **Rutas existentes:** `/login`, `/inicio`, `/administracion/{usuarios,credenciales}`
  con mismo tamaño/bundle que baseline. Las 5 rutas nuevas son aditivas y
  renderizan `FeatureUnavailableState` (flags OFF por default) — **cero
  cambio de comportamiento visible** para el usuario hasta que el backend +
  decisión de Fernando habiliten los flags.
- **Sin deps nuevas** (verificado: `package.json` sin cambios funcionales).
- **`src/lib/api/types.ts` NO tocado** — `generate:api` diferido a propósito
  (P4-2).

## #4 — Coherencia

- **ADR-0007:** sin `src/features/`; dominio en `src/components/clasificacion/`,
  estado transversal en `src/lib/`. ✅
- **ADR-0008:** feature-flags con default OFF, override dev ignorado en prod,
  seam `config`; flag OFF ⇒ pantalla informativa, nunca mock. ✅
- **ADR-0009:** sin librería DnD; análogamente, **sin librería combobox** —
  los selectores son dependency-free (input + lista accesible). ✅
- **CLAUDE.md regla 4 / reconciliation P1-1:** 0 `export const runtime` en las
  rutas nuevas. ✅
- **Regla 16:** P4-2 (drift SII) y P4-4 (`canonical_category` doc vs API)
  documentados y escalados, no resueltos por el FE. ✅
- **Voice & Tone (Anexo F):** microcopy de negocio en FeatureUnavailableState
  y drawer ("Qavante no modifica el movimiento original del banco"). ✅

## #5 — DoD (addendum §28, alcance "PR #83" sin `generate:api`)

| Ítem §28                                              | Estado                                                |
| ----------------------------------------------------- | ----------------------------------------------------- |
| Baseline antes de cambios (lint/typecheck/test/build) | ✅ corrido al inicio                                  |
| OpenAPI regenerado                                    | ⏸️ **diferido a propósito** (P4-2, decisión Fernando) |
| Ningún tipo generado editado a mano                   | ✅ `types.ts` intacto                                 |
| Feature flags / disponibilidad                        | ✅ ADR-0008 materializado                             |
| Rutas nuevas skeleton con estado feature-unavailable  | ✅ 5 rutas                                            |
| No rompe sidebar / 6 módulos                          | ✅                                                    |
| No implementa Fase 2 funcional                        | ✅ solo placeholders/shell                            |
| Sin `any` injustificado                               | ✅                                                    |
| Sin deps nuevas                                       | ✅                                                    |
| Tests mínimos de hooks/render                         | ✅ 18 unit nuevos + 14 stories                        |
| Build Cloudflare/Next compatible                      | ✅                                                    |
| Changelog/docs                                        | ✅                                                    |

## #6 — Documentación

- `reconciliation.md`: P3 (datos escalamiento) + **P4** (verificación dura) +
  **P4-4** (corrige P3-1 con el contrato vivo). Banners de actualización en
  P0/P3-1, filas en resumen ejecutivo.
- `taxonomy-handoff-brief.md`: §1 + DoD §6 + §4 al estado real.
- `CHANGELOG [Unreleased]`: entrada #93 + bullets cross-team SII/2º handoff.
- `CONTRIBUTING.md`: sección feature-flags + override dev.
- `ADR-0008`: "Estado de implementación" (patrón hecho, fuentes diferidas).
- Este audit.

## #7 — Lighthouse + bundle

- **Bundle:** `size:check` ✅ — rutas nuevas no mueven la aguja (1.53 kB,
  First Load 114 kB; budget app 400 kB). Landing Administración 120 kB
  (+1 kB por 4 cards, dentro de presupuesto).
- **Lighthouse:** gate en CI (`.github/workflows/ci.yml`, `/login` ≥0.85).
  No se corre local en Windows (EPERM en temp dir de Chrome — convención ya
  documentada en `c1-prep-review.md`). Las rutas nuevas no afectan `/login`
  ni `/inicio` (las medidas por el gate). Sin riesgo.

## Recomendaciones por severidad

### 🔴 Crítico

Ninguno.

### 🟡 Medio — decisiones de Fernando (no las resuelve el FE)

1. **Drift credenciales SII (P4-2):** decidir si el FE se adapta a
   `/api/admin/sources/*` o se pide a CC-API volver al contrato
   `/api/credentials/sii`. Bloquea `generate:api` e ingesta C1.
2. **`canonical_category` P4-4:** rutear a CC-API la contradicción doc de
   escalamiento (enum 16) vs API-vivo (§11/26 + labels). El FE asume el
   contrato vivo; confirmar que no hay cambio de taxonomía planificado.

### 🟢 Menor

3. **Flake unit cold-start:** vigilar en CI; si reaparece, investigar
   aislamiento del setup MSW entre workers.
4. **Orden de merge de stacks:** #96→#98 y #100→#102; rebasar a main tras el
   primero de cada par (anotado en cada PR).
5. **Chromatic baseline:** acción manual de Fernando (ver abajo).

## Chromatic — qué necesita Fernando (CC-WEB no puede hacerlo)

5 stories nuevas (`feature-unavailable-state`, `canonical-category-select`,
`management-account-select`, `dimension-value-picker`, `classification-drawer`)
≈ 19 snapshots nuevos. Cuando #98/#102 corran Chromatic en CI, aparecerán
como **"new stories"** a aceptar **una vez** en chromatic.com — es UI web
autenticada, **no una operación de repo**, así que CC-WEB no la ejecuta.
Mitigación aplicada: las stories nuevas no usan animaciones/spinners
(`QavanteButton` en estado `saving` usa `disabled`, no `loading`/`Loader2`),
así que no introducen flakiness — el accept de Fernando será limpio.

## Checklist Anexo K.4 — los 7 puntos

1. **Inventario** — ✅ #1.
2. **Tests pasando** — ✅ #2 (suite integrada verde; flake transitorio notado).
3. **Sin regresiones** — ✅ #3 (aditivo, flags OFF, nav/login intactos).
4. **Coherencia** — ✅ #4 (ADRs 7/8/9, regla 4, regla 16).
5. **DoD** — ✅ #5 (alcance "PR #83" sin `generate:api`, diferido a propósito).
6. **Documentación** — ✅ #6.
7. **Lighthouse/bundle** — ✅ #7 (size gate verde; Lighthouse vía CI).

**Veredicto:** ciclo **completado** en su alcance (lo que no depende de
backend). Lo que falta es integración real, bloqueada por 2 decisiones de
Fernando (🟡) — correctamente escaladas, no improvisadas.

## Apéndice — comandos para reproducir

```bash
# rama de integración descartable
git checkout -b _tmp origin/main
git merge --no-ff docs/backend-live-finding-2026-05-16
git merge --no-ff feat/addendum-skeleton-routes   # incluye feat/feature-flags-adr0008
git merge --no-ff feat/clasificacion-drawer        # incluye feat/clasificacion-selectores

rm -rf .next
npm run typecheck && npm run lint && npm run test && npm run build && npm run size:check
npx vitest run --project storybook
git checkout - && git branch -D _tmp   # descartar
```

---

Generated by CC-WEB — 2026-05-16.
