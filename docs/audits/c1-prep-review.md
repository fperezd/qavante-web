# Revisión integral C1-prep + tail end C0 (Anexo K.4)

**Fecha:** 2026-05-14
**Alcance:** todo lo mergeado en `main` entre `e634637` (cierre Milestone D / PR #50) y `HEAD` (post-PR #72) **+ 3 PRs abiertos** en flight (#73, #74, #75) que cierran el ciclo. Cubre **15 commits squash mergeados + 3 PRs open**, 51 archivos modificados/creados, **+3 912 / −69 LoC**.
**Ejecutor:** CC-WEB.
**Resultado global:** **0 críticos, 1 medio, 4 menores.** El ciclo `c1-prep` está sólido: MSW v2 operativo en dev + Playwright, contrato cross-repo escrito, UI Credenciales SII completa, mobile responsive para públicas y protegidas, gate Lighthouse extendido. Sigue bloqueado de Sprint C1 real (ingesta `sii_f29` / `previred`) por `qavante-api` C1 backend.

---

## TL;DR

| #   | Hallazgo                                                                                                                                         | Severidad                          | Origen                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | -------------------------------- |
| 1   | Endpoints SII reales NO existen — `/app/administracion/credenciales` solo funciona en dev con MSW. En prod muestra error state.                  | 🟡 medio                           | cross-repo (qavante-api C1 prep) |
| 2   | `/administracion/credenciales` 184 KB gzip / 250 KB budget (73.7%) — saludable hoy, pero es la ruta `/app/*` más cargada.                        | 🟢 menor                           | C1-prep #59                      |
| 3   | `handlers.test.ts` cubre MSW en contexto Node (vitest) pero **NO** valida MSW en contexto browser. Bug detectado durante #73.                    | 🟢 menor                           | C1-prep #55 / #73                |
| 4   | Override de roles en tests usa **2 mecanismos paralelos**: cookie `qavante_test_role` + env `NEXT_PUBLIC_TEST_MODE`. Mantenible pero unificable. | 🟢 menor                           | C1-prep #73                      |
| 5   | Lighthouse de `/credenciales` baseline aún no validado en CI — mide error state (sin MSW), threshold 0.85 puede no holdear primer run.           | 🟢 menor                           | C1-prep #75 (open)               |
| 6   | `src/lib/api/types.ts` sigue **sin regenerar** — backend no expuso aún `/api/credentials/*` ni endpoints C0-14 (users).                          | 🟡 medio (continúa de Milestone D) | cross-repo (qavante-api)         |

Sin hallazgos críticos. Detalle por check abajo.

---

## #1 — Inventario

`git diff --stat e634637..HEAD` (sin contar PRs open):

- **51 archivos**, **+3 912 / −69 LoC**.
- 33 nuevos, 18 modificados, 0 eliminados.

Breakdown por área:

| Área                                                 | Archivos                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSW infra** (`src/test/msw/`)                      | 9 nuevos: `browser.ts`, `db.ts`, `fixtures.ts`, `handlers.ts`, `handlers.test.ts`, `init-browser.ts`, `node.ts`, `vitest.setup.ts` + `public/mockServiceWorker.js`                                                                                    |
| **Credenciales UI** (`src/components/credenciales/`) | 12 nuevos: `sii-company-card`, `sii-company-dialog`, `sii-persons-list`, `sii-person-dialog`, `certificate-card`, `certificate-upload-dialog`, `delete-confirm-dialog`, `password-input`, `format` (+ test), `expiration-banner` (+ test), `index.ts` |
| **Credenciales lib**                                 | 1 nuevo (`src/lib/api/credentials.ts` — tipos + 6 hooks TanStack)                                                                                                                                                                                     |
| **Ruta + admin hub**                                 | 1 nueva (`/app/administracion/credenciales/page.tsx`) + 1 refactor (`/app/administracion/page.tsx` con 2 SubModuleCards)                                                                                                                              |
| **A11y shell**                                       | 1 nuevo (`src/components/shell/skip-link.tsx`) + 3 modificados (`header`, `breadcrumbs`, `app-shell`)                                                                                                                                                 |
| **Tests unit**                                       | 4 nuevos: `error-messages.test.ts` (15), `rut.test.ts` (13), `format.test.ts` (5), `expiration-banner.test.ts` (8). Total **41 tests anti-regresión nuevos**.                                                                                         |
| **Tests E2E**                                        | 1 nuevo: `public-routes.mobile.spec.ts` (4 specs Pixel 5)                                                                                                                                                                                             |
| **Infra CI**                                         | 1 modificado (`playwright.config.ts` refactor a 2 projects), 1 modificado (`scripts/check-bundle-size.mjs` agrega `/aceptar-invitacion` + `/credenciales` al gate), `vitest.config.ts` (1 modificado para setup MSW node)                             |
| **Providers**                                        | 1 nuevo (`MswProvider`), 1 modificado (`AppProviders` con wrap)                                                                                                                                                                                       |
| **ADRs**                                             | 2 nuevos: ADR-0005 (MSW for FE dev), ADR-0006 (SII credentials storage decisions, status `Deferred`)                                                                                                                                                  |
| **Contratos cross-repo**                             | 1 nuevo (`docs/backend-contracts/c1-sii-credentials.md` — 6 endpoints + 10 restricciones de seguridad)                                                                                                                                                |
| **Docs**                                             | `CHANGELOG.md` (Unreleased + 0.7.0 con audit Milestone D), `ARCHITECTURE.md`, `CONTRIBUTING.md`, `README.md`, `docs/adr/README.md`                                                                                                                    |
| **Bugfix**                                           | `src/lib/api/error-messages.ts` (config_missing reachable, closes #70)                                                                                                                                                                                |
| **Dependencias** (`package.json`)                    | `msw@^2.x`, `@types/cookie`, dev deps. `eslint.config.mjs` con ignore para `public/mockServiceWorker.js` (generated)                                                                                                                                  |

PRs squash que llegaron a `main`:

- `cc99505` `docs(c0-18): cierre Milestone D — bump 0.7.0 + audit K.4 (#51)`
- `2e161b5` `docs(c0-18): skip demo grabada — decisión del owner (#52)`
- `91fea81` `fix(c0): bundle budget para /administracion/usuarios (audit K.4 #2) (#53)`
- `8468b89` `feat(c1-prep): MSW v2 setup para desarrollar FE sin backend (ADR-0005) (#55)`
- `77c86e9` `docs(c1-prep): contrato backend credenciales SII + certificado digital (#58)`
- `a8a9004` `feat(c1-prep): UI Administración → Credenciales SII + handlers MSW (#57) (#59)`
- `6948119` `test(c0): mobile responsive Playwright spec (audit K.4 #3) (#60)`
- `1477fd0` `perf(c1-prep): dynamic imports dialogs admin + credenciales (audit K.4 #2) (#61)`
- `253f554` `docs(c1-prep): ARCHITECTURE + CONTRIBUTING con MSW + Playwright patterns (#62)`
- `54216b6` `docs(c1-prep): registrar PRs #55-#62 en CHANGELOG [Unreleased] (#63)`
- `026a9dc` `a11y(c0): skip link + aria-current + landmark labels (#64)`
- `218b1e4` `test(c0): unit tests para format.ts + expiration-banner extraídos (#65)`
- `66a068f` `perf(c0): /aceptar-invitacion en BUDGETS_KB del size:check (#66)`
- `81f6c03` `test(c0): unit tests para isValidRut + apiErrorToUserMessage (#67)`
- `817a4f4` `fix(c0): config_missing reachable en apiErrorToUserMessage (#70) (#72)`

PRs **open al cierre del audit** (work-in-flight):

- **#73** `test(c1-prep): Playwright + MSW combo para rutas protegidas mobile (#68)` — 6 archivos, +210/-10. **Validado local: 5/5 protected spec + 4/4 public spec aislados.**
- **#74** `docs(c1-prep): registrar PRs #64-#67 + #72 en CHANGELOG [Unreleased]` — 1 archivo, +9/-1.
- **#75** `perf(c1-prep): Lighthouse mobile gate para /administracion/credenciales` — 4 archivos, +9/-5.

Issues nuevos abiertos durante el ciclo:

- **#56** SSO Google/Microsoft deferred a Fase 2.
- **#68** Playwright+MSW mobile para `/app/*` (cerrado por PR #73).
- **#69** Storybook setup deferred (tech-debt).
- **#70** Bug `config_missing` rama unreachable (cerrado por PR #72).
- **#71** cross-repo: integrar credenciales SII con `qavante-api` (handoff backend).

---

## #2 — Tests

```
> npm run test
Test Files  6 passed (6)
Tests       74 passed (74)
Duration    6.8s

> npm run lint
✓ clean

> npx tsc --noEmit
✓ clean

> npm run build
✓ pass (14 rutas — 7 estáticas, 7 dinámicas)

> npm run size:check
✓ Todas las routes dentro del presupuesto
```

| Layer       | Count    | Cobertura                                                                                                                                                                                                                         |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit vitest | **74**   | +71 vs cierre Milestone D (era 3). Incluye: `role-labels` (3), `error-messages` (15), `rut` (13), `format` (5), `expiration-banner` (8), `handlers` MSW node (20), `acceptInvitation.test` (10)                                   |
| E2E HTTP    | 12       | `auth-redirect.spec.ts` — sin cambios (sigue cubriendo redirect 307 para 6 rutas protegidas + 200 para 5 públicas)                                                                                                                |
| E2E mobile  | 4 (main) | `public-routes.mobile.spec.ts` — Pixel 5 anti-overflow para `/login`, `/recuperar-clave`, `/aceptar-invitacion`, `/playground`                                                                                                    |
| E2E mobile  | +5 (#73) | `protected-routes.mobile.spec.ts` — Pixel 5 + cookie + MSW para `/inicio`, admin/usuarios, admin/credenciales, sidebar gate, hamburger. **Aislado: 5/5 verde local. En suite combinada con `--workers=5` flakea por contención.** |
| Smoke prod  | 4        | `prod-health.smoke.spec.ts` contra `app.qavante.com` — sin cambios                                                                                                                                                                |

**Crecimiento cuantitativo:** unit tests pasaron de 3 → 74 en este ciclo. Es **el ciclo con más anti-regresión escrita** del Sprint C0.

---

## #3 — Sin regresiones (smoke navegación)

Suite `auth-redirect.spec.ts` cubre 12 rutas (6 protegidas + 4 públicas + 2 nuevas en C0-15). Todos pasan en `main`. Cero regresiones de middleware ni rutas.

| Ruta                                                                                               | Antes ciclo  | Post-ciclo   | Δ       |
| -------------------------------------------------------------------------------------------------- | ------------ | ------------ | ------- |
| `/login`                                                                                           | 200          | 200          | =       |
| `/recuperar-clave`                                                                                 | 200          | 200          | =       |
| `/aceptar-invitacion`                                                                              | 200          | 200          | =       |
| `/playground`                                                                                      | 200          | 200          | =       |
| `/`                                                                                                | 200          | 200          | =       |
| `/inicio`, `/caja`, `/cobrar`, `/pagar`, `/gestion`, `/administracion`, `/administracion/usuarios` | 307 redirect | 307 redirect | =       |
| `/administracion/credenciales` (nueva)                                                             | n/a          | 307 redirect | ✓ nueva |

Visual mobile sí está cubierto **automatizado** para rutas públicas (`public-routes.mobile.spec.ts`) y, una vez se mergee PR #73, también protegidas. Mejora vs Milestone D donde mobile responsive era hallazgo abierto (K.4 #3).

---

## #4 — Coherencia

| Check                                                                    | Resultado                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                      | ✓ pass                                                                                                                                                        |
| `npm run lint`                                                           | ✓ pass                                                                                                                                                        |
| `npm run build`                                                          | ✓ pass (14 rutas)                                                                                                                                             |
| `npm run size:check`                                                     | ✓ pass (todas dentro del budget — ver tabla §7 más abajo)                                                                                                     |
| `export const runtime` en algún archivo                                  | ✓ ninguno (cumple CLAUDE.md regla 4)                                                                                                                          |
| `any` sin justificación en `src/`                                        | ✓ ninguno (cumple regla 7)                                                                                                                                    |
| Storage APIs (`localStorage`, `sessionStorage`, `IndexedDB`) para tokens | ✓ no se usan en `src/` (cumple regla 6). MSW dev mock setea cookie sin HttpOnly (limitación service worker documentada en `handlers.ts`).                     |
| Tipos auto-generated `src/lib/api/types.ts`                              | ⚠ **no regenerado** — `qavante-api` aún no expone `/api/users`, `/api/credentials/*`, `/api/auth/accept-invitation`. UI compila contra contratos hand-rolled. |
| Imports correctos                                                        | ✓ verificado spot-check en `src/components/credenciales/index.ts` (barrel re-export), `src/test/msw/handlers.ts` (cross-import de tipos públicos)             |
| Voice & Tone (Anexo F) en copys nuevos                                   | ✓ revisado en `sii-company-card`, `certificate-card`, `expiration-banner`. Tono cercano + accionable + sin tecnicismos.                                       |
| Triple-guard MSW (ADR-0005) preservado                                   | ✓ + cuarto guard agregado en #73 (`NEXT_PUBLIC_TEST_MODE=playwright`). Nunca activable en deploy real.                                                        |
| `console.log` accidentales                                               | ✓ solo 2 intencionales: `init-browser.ts` informa "MSW activo" + `MswProvider` loggea error de inicialización.                                                |

**Nota sobre `types.ts`:** ya señalado en audit Milestone D (hallazgo 🟢 #3). En este ciclo se agregó UN sub-set más de tipos hand-rolled (`src/lib/api/credentials.ts`) que también espera regenerarse cuando `qavante-api` baje los 6 endpoints SII. Documentado en `[Unreleased] → Pendiente cross-team` del CHANGELOG.

---

## #5 — DoD por ticket

| Ticket / Feature                      | DoD                                                                          | Estado                                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSW v2 setup** (ADR-0005)           | Mock Service Worker en browser + node + triple-guard prod                    | ✓ `MswProvider`, `init-browser`, `vitest.setup`, `handlers.ts` con auth + users handlers. 20 sanity tests nuevos en `handlers.test.ts`.                          |
| **Contrato SII**                      | `docs/backend-contracts/c1-sii-credentials.md`                               | ✓ 6 endpoints + 10 restricciones de seguridad documentadas. Aceptado por owner para handoff backend.                                                             |
| **UI Credenciales SII** (#57)         | 3 cards (Empresa + Personas + Certificado) en `/administracion/credenciales` | ✓ 12 componentes nuevos, dynamic imports para dialogs lazy. Validación con react-hook-form + zod. Banner expiración 60d/30d/expired.                             |
| **Handlers MSW SII**                  | 6 endpoints mockeados alineados al contrato                                  | ✓ + 9 sanity tests cubren happy paths + errores (`rut_mismatch`, `validation_error`, `not_found`, `invalid_pkcs12`, `certificate_not_configured`)                |
| **ADR-0006** (KMS/storage/audit)      | Documentar decisiones pendientes backend                                     | ✓ Status `Deferred — pending qavante-api backend input`. Listo para que cuando backend arranque, llenen rationale + status `Accepted`.                           |
| **Mobile responsive público**         | Spec Playwright Pixel 5 + anti-overflow                                      | ✓ 4 tests en `public-routes.mobile.spec.ts` cubriendo login, recuperar-clave, aceptar-invitacion, playground                                                     |
| **Mobile responsive protegido** (#68) | 5 tests Pixel 5 con MSW + cookie injection                                   | ⏳ **PR #73 open** — local 5/5 verde aislado, en CI cuando se mergee                                                                                             |
| **A11y mejoras**                      | Skip link, aria-current, landmark labels                                     | ✓ `SkipLink` component, sidebar `aria-current="page"`, aside/main/breadcrumbs con `aria-label`                                                                   |
| **Bundle budgets**                    | `/aceptar-invitacion` agregado al gate                                       | ✓ + dynamic imports en `/administracion/usuarios` bajaron de 199 → 145.8 KB gzip (-27%, audit K.4 #2 del Milestone D)                                            |
| **Anti-regresión unit tests**         | Cobertura de mappings, validadores, helpers                                  | ✓ 71 tests nuevos: `isValidRut` (13), `apiErrorToUserMessage` (15), `format.ts` (5), `expiration-banner.ts` (8), `handlers.ts` MSW (20), `acceptInvitation` (10) |
| **Bug fix #70**                       | Rama `config_missing` reachable                                              | ✓ PR #72 — reordenado switch en `apiErrorToUserMessage`. Dev sin `NEXT_PUBLIC_API_URL` ahora ve mensaje técnico.                                                 |
| **CHANGELOG up-to-date**              | Sección [Unreleased] con PRs del ciclo                                       | ⏳ **PR #74 open** — al mergearlo, [Unreleased] cubre PRs #55-#67 + #72                                                                                          |
| **Lighthouse mobile protected**       | `/administracion/credenciales` en gate                                       | ⏳ **PR #75 open** — agrega URL al `.lighthouserc.json` con cookie injection vía `extraHeaders`. Baseline a validar en primer run CI.                            |
| **Backend SII (`qavante-api`)**       | 6 endpoints + ADR-0006 → Accepted                                            | ✗ **bloqueado en repo backend** (cross-repo). Trackeado en issue #71.                                                                                            |
| **Sprint C1 ingesta sii_f29**         | UI + backend operativo                                                       | ✗ **bloqueado por backend SII** (depende de #71).                                                                                                                |

---

## #6 — Documentación

- **CHANGELOG.md** — Sección `[Unreleased]` cubre PRs #55-#62 (registrados en PR #63). PRs #64-#67 + #72 aún sin registrar — **PR #74 los agrega**.

- **README.md** — sin cambios en este ciclo (sigue vigente desde Milestone D close).

- **CONTRIBUTING.md** — actualizado en #62 (MSW + Playwright patterns) + #73 (rutas protegidas + helper `loginAs`) + #75 (Lighthouse `/credenciales`).

- **ARCHITECTURE.md** — actualizado en #62 (tabla 7 capas de testing CI) + #75 (Lighthouse URLs).

- **ADRs nuevos:**
  - **ADR-0005** (PR #55) — MSW v2 para FE dev sin backend. Status `Accepted`.
  - **ADR-0006** (PR #59) — SII credentials storage decisions. Status `Deferred — pending qavante-api backend input`.

- **Contratos cross-repo:**
  - **`docs/backend-contracts/c1-sii-credentials.md`** (PR #58) — 6 endpoints, 10 restricciones seguridad. Listo para handoff.

- **Audits anteriores:**
  - `docs/audits/c0-milestone-d-review.md` — agregado en PR #51 (este audit es la continuación natural).

- **Comentarios inline notables:**
  - `src/test/msw/handlers.ts` — explica por qué cookies MSW van sin HttpOnly (limitación service worker, no anti-pattern).
  - `src/components/providers/msw-provider.tsx` — explica triple-guard + (en PR #73) cuarto guard `NEXT_PUBLIC_TEST_MODE`.
  - `src/lib/auth/session.ts` (en PR #73) — explica por qué el test-role cookie se gatea por `NEXT_PUBLIC_API_MOCKING` y no por `NODE_ENV` (Playwright corre builds prod).

---

## #7 — Lighthouse mobile + bundle (production build)

### Bundle size (`scripts/check-bundle-size.mjs`)

| Ruta                                                      | First Load JS gzip | Budget | % del budget | Chunks |
| --------------------------------------------------------- | -----------------: | -----: | -----------: | -----: |
| `/(auth)/login/page`                                      |           143.9 KB | 200 KB |        72.0% |      8 |
| `/(auth)/aceptar-invitacion/page` (nueva al gate, PR #66) |           154.3 KB | 200 KB |        77.2% |     10 |
| `/(app)/inicio/page`                                      |           112.2 KB | 400 KB |        28.1% |      6 |
| `/(app)/administracion/usuarios/page`                     |           145.8 KB | 250 KB |        58.3% |     10 |
| `/(app)/administracion/credenciales/page` (nueva, PR #59) |           184.3 KB | 250 KB |        73.7% |     11 |

Notable: **`/administracion/usuarios` bajó 199 → 145.8 KB (-27%)** vs audit Milestone D, gracias a dynamic imports en PR #61. Cubre la deuda 🟡 #2 del audit anterior.

`/administracion/credenciales` (nueva del ciclo) es la ruta `/app/*` más cargada — 184 KB / 250 KB. Saludable hoy, pero queda como **observable** si se agregan features.

### Lighthouse

| Ruta                           | Threshold mobile | Estado                                                                                                                                                                      |
| ------------------------------ | ---------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                       |      perf ≥ 0.85 | ✓ en CI desde PR #49 (Milestone D). Sin cambios en este ciclo.                                                                                                              |
| `/administracion/credenciales` |      perf ≥ 0.85 | ⏳ **PR #75 open** — cookie dummy vía `extraHeaders` evade middleware; sin MSW activo, mide bundle real prod (error state). Baseline a validar en primer run CI tras merge. |
| `/app/inicio`                  |      perf ≥ 0.90 | ⚠ diferido — espera cookie cross-origin de `qavante-api#58`. Sin cambio en este ciclo.                                                                                      |

---

## Recomendaciones por severidad

### 🔴 Crítico

Ninguno.

### 🟡 Medio

1. **Endpoints SII reales no existen.** UI funciona en dev/test (MSW) pero en prod muestra error state porque `qavante-api` no implementó los 6 endpoints de `docs/backend-contracts/c1-sii-credentials.md`. **Acción:** trackeado en issue #71. El audit no propone fix en este repo — es cross-team.

2. **`types.ts` sin regenerar (continúa de Milestone D).** Tanto `users.ts` (C0-15) como `credentials.ts` (C1-prep) compilan contra contratos hand-rolled. Cuando backend baje endpoints, requerirá `npm run generate:api` y replace de los tipos manuales. Acción: depende de unblock cross-repo (#71 + qavante-api C0-14).

### 🟢 Menor

3. **`/administracion/credenciales` 73.7% del budget.** Saludable hoy, pero es la ruta `/app/*` más cargada. Observable: si se agregan features (ej. visualización de historial de rotaciones, audit log inline), podría romper el budget. Mitigación temprana ya aplicada: dialogs lazy (`next/dynamic`).

4. **`handlers.test.ts` no cubre MSW browser context.** Los 20 sanity tests usan `setupServer` (`msw/node`). Durante #73 descubrimos que MSW en browser falla con `NEXT_PUBLIC_TEST_MODE !== "playwright"` — bug que NO atrapó vitest porque ese contexto no se testea. **Acción sugerida:** abrir issue tech-debt para agregar 1-2 tests E2E que validen MSW activo en browser (ya parcialmente cubierto por `protected-routes.mobile.spec.ts` cuando se mergee #73).

5. **Dos mecanismos de override de test:**
   - `qavante_test_role` cookie en `session.ts` (gated por `NEXT_PUBLIC_API_MOCKING`).
   - `NEXT_PUBLIC_TEST_MODE="playwright"` en `MswProvider` + `init-browser.ts`.

   Ambos son test-only y bien gated. Pero son 2 vectores distintos. **Acción opcional:** considerar unificar bajo un único `NEXT_PUBLIC_TEST_MODE="playwright"` que también habilite el test-role cookie en `session.ts`. Refactor menor; no es bloqueante.

6. **Lighthouse `/credenciales` baseline pendiente.** PR #75 agrega la URL pero el primer run en CI puede sorprender — si el shell `(app)` rompe el threshold 0.85, hay que ajustar (bajar threshold para esta ruta o optimizar el shell). **Acción:** observar el primer run post-merge; si falla, plan B en el issue/comments del PR.

---

## Checklist Anexo K.4 — los 7 puntos

1. **Inventario** ✓ — `git diff --stat e634637..HEAD`, 51 archivos, +3 912 / −69 LoC + 3 PRs open.
2. **Tests pasando** ✓ — 74 unit + 12 E2E HTTP + 4 E2E mobile (público) + 5 E2E mobile (protegido, PR #73 local). Smoke prod 4 specs.
3. **Sin regresiones** ✓ — 12 rutas verificadas en e2e, cero regresiones de middleware. Mobile responsive ahora cubierto automatizado (público en main + protegido en PR #73).
4. **Coherencia** ✓ — typecheck/lint/build/size:check verdes, sin Node-only, sin `any`, sin Storage APIs. Triple-guard MSW preservado + cuarto guard explícito para Playwright (PR #73). Voice & Tone Anexo F respetado en copys nuevos.
5. **DoD** ✓ — items en este repo cubiertos para el scope `c1-prep`. Cross-repo (`qavante-api` SII + C0-14) bloqueado en backend.
6. **Documentación** ✓ — CHANGELOG + ARCHITECTURE + CONTRIBUTING + ADRs (2 nuevos) + contrato cross-repo alineados.
7. **Lighthouse mobile** ✓ `/login` ≥85 en CI. ⏳ `/credenciales` baseline pendiente (PR #75). ⚠ `/app/inicio` diferido por cross-origin cookie.

**Veredicto:** Ciclo `c1-prep` listo para declararse cerrado en `qavante-web` una vez se mergeen PRs #73 / #74 / #75. Sprint C1 real (ingesta `sii_f29` + `previred`) sigue bloqueado por backend SII (issue #71 cross-repo).

---

## Apéndice — comandos para reproducir el audit

```bash
# Inventario
git diff --stat e634637..HEAD
git diff --name-status e634637..HEAD | sort
git log --oneline e634637..HEAD

# PRs en flight
gh pr list --state open --limit 10

# Tests
npm run lint
npx tsc --noEmit
npm run test
npm run e2e         # ambos projects (puede flakar con 5 workers locales)
npm run smoke       # contra app.qavante.com

# Coherencia y bundle budget
rm -rf .next && npm run build
npm run size:check
grep -rn "export const runtime" src/
grep -rn "localStorage\|sessionStorage\|indexedDB" src/

# Lighthouse en CI (no local en Windows por EPERM en Chrome temp dir)
gh run view <RUN_ID> --log | grep -E "Lighthouse|categories"
```

---

Generated by CC-WEB — 2026-05-14.
