# Revisión integral C0 — Milestone D (Anexo K.4)

**Fecha:** 2026-05-13
**Alcance:** todo lo mergeado en `main` entre `dce49a7` (último commit pre-Milestone D, `docs(c0-18): CONTRIBUTING.md + ARCHITECTURE.md`) y `e634637` (HEAD tras mergear los 4 PRs de cierre). Cubre 4 PRs, 23 archivos, **+4 389 / −268 LoC**.
**Ejecutor:** CC-WEB.
**Resultado global:** **0 críticos, 1 medio, 2 menores.** Milestone D listo para declararse completado en lo que depende de `qavante-web`. Cierre formal del Sprint C0 sigue dependiendo de items manuales (demo grabada, tag de release).

---

## TL;DR

| #   | Hallazgo                                                                                                            | Severidad | Origen                      |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------- |
| 1   | `/api/users`, `/api/auth/accept-invitation`, `/api/me` reales NO existen — UI de Admin renderea error state.        | 🟡 medio  | cross-repo (qavante-api)    |
| 2   | `/app/administracion/usuarios` First Load = **199 kB** raw (no gzip), al borde del budget 200 kB del Kit DoD 5.2.   | 🟢 menor  | C0-15 (#44)                 |
| 3   | Lighthouse en CI cubre `/login` (≥85 mobile, en CI ✓). `/app/inicio` queda diferido hasta cookie cross-origin real. | 🟢 menor  | qavante-api#58 (cross-repo) |

Sin hallazgos críticos. Detalle por check abajo.

---

## #1 — Inventario

`git diff --stat dce49a7..HEAD`:

- 23 archivos modificados/creados, **+4 389 / −268 LoC**.
- 12 nuevos, 11 modificados, 0 eliminados.

Breakdown por área:

| Área                                        | Archivos                                                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin UI (`src/components/administracion/`) | 7 nuevos: `users-table`, `invite-user-dialog`, `suspend-user-dialog`, `role-select`, `role-labels`, `role-labels.test`, `status-badge`                                                                               |
| Rutas FE                                    | 2 nuevas (`(auth)/aceptar-invitacion/page.tsx`, `(auth)/aceptar-invitacion/form.tsx`), 1 modificada (`(app)/administracion/usuarios/page.tsx` reemplaza placeholder), 1 modificada (`(app)/layout.tsx` para session) |
| Shell                                       | 2 modificados (`shell/sidebar.tsx` con `visibleFor`, `shell/app-shell.tsx` forwardea `userRole`)                                                                                                                     |
| Lib                                         | 1 nuevo (`src/lib/api/users.ts` — tipos + hooks TanStack Query)                                                                                                                                                      |
| Tests                                       | 1 unit nuevo (`role-labels.test.ts`, 3 tests anti-regresión) + 1 e2e modificado (`auth-redirect.spec.ts` agrega `/aceptar-invitacion` a PUBLIC_PATHS)                                                                |
| Infra CI                                    | 1 nuevo (`.lighthouserc.json`), 1 modificado (`.github/workflows/ci.yml` — job `lighthouse`), 1 modificado (`.gitignore` — `.lighthouseci/`)                                                                         |
| Docs                                        | 1 nuevo (`CHANGELOG.md` Keep a Changelog 1.1.0, 5 releases pre-v1.0), 1 modificado (`README.md` Milestone D status + link), 1 modificado (`CONTRIBUTING.md` DoD line auto)                                           |
| Dependencias                                | `package.json` + `package-lock.json` — agrega `@lhci/cli@^0.15.1` (devDep)                                                                                                                                           |

Commits squash que llegaron a `main`:

- `5922fb5` `feat(c0-15): UI Administración → Usuarios + /aceptar-invitacion (#44)`
- `3f4a9fc` `feat(c0-15): sidebar gate — hide Administración para roles sin permiso (#48)`
- `8c56e14` `feat(c0): Lighthouse CI mobile en /login (Kit DoD sec 5.2) (#49)`
- `e634637` `docs(c0-18): CHANGELOG.md inicial + README Milestone D status (#50)`

---

## #2 — Tests

```
> npm run test
Test Files  1 passed (1)
Tests       3 passed (3)
Duration    527ms

> npm run e2e
17 tests in 2 specs:
  - auth-redirect.spec.ts: 12 passed (todas las rutas protegidas redirigen 307 + públicas pasan 200)
  - prod-health.smoke.spec.ts: 4 passed + 1 skipped
Total: 16 passed, 1 skipped, 0 failed (56.3s)
```

- **Unit (vitest)**: 3 tests en `role-labels.test.ts` — anti-regresión sobre mapping `UserRole → label` (es-CL) y filtrado de roles asignables (excluye `technical_admin` de la UI de invitación).
- **E2E (Playwright)**: `auth-redirect.spec.ts` cubre 12 rutas (8 protegidas + 4 públicas). `/aceptar-invitacion` agregada a `PUBLIC_PATHS` y verificada 200 sin sesión.
- **Smoke prod**: 4 specs HTTP/browser contra `https://app.qavante.com` pasan. El smoke gated de login real queda skipped (espera `SMOKE_RUT`/`SMOKE_PASSWORD` env + cookie cross-origin de qavante-api#58).

Mejora cuantitativa vs audit ABC: pasamos de **0 tests** (audit del 2026-05-12) a **3 unit + 16 e2e funcionando**. Cubre la deuda 🟡 #4 del audit anterior.

---

## #3 — Sin regresiones (smoke navegación)

Suite Playwright cubrió funcionalmente las 12 rutas:

| Ruta                       | Comportamiento esperado      | Resultado |
| -------------------------- | ---------------------------- | --------- |
| `/login`                   | 200 sin sesión               | ✓         |
| `/`                        | 200 sin sesión               | ✓         |
| `/recuperar-clave`         | 200 sin sesión               | ✓         |
| `/playground`              | 200 sin sesión               | ✓         |
| `/aceptar-invitacion`      | 200 sin sesión (nuevo C0-15) | ✓         |
| `/inicio`                  | 307 → `/login?redirect=...`  | ✓         |
| `/caja`                    | 307 → `/login?redirect=...`  | ✓         |
| `/cobrar`                  | 307 → `/login?redirect=...`  | ✓         |
| `/pagar`                   | 307 → `/login?redirect=...`  | ✓         |
| `/gestion`                 | 307 → `/login?redirect=...`  | ✓         |
| `/administracion`          | 307 → `/login?redirect=...`  | ✓         |
| `/administracion/usuarios` | 307 → `/login?redirect=...`  | ✓         |

Cero regresiones vs Milestone A/B/C. El fix del middleware (audit ABC hallazgo crítico #1) sigue vivo.

Visual mobile/responsive + comportamiento sidebar `visibleFor` con session.role=viewer **NO** se valida automatizado (requiere navegación browser real con session.role mockeado). Queda para verificación manual de Fernando antes de la demo grabada.

---

## #4 — Coherencia

| Check                                            | Resultado                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `npm run typecheck`                              | ✓ pass                                                                           |
| `npm run lint`                                   | ✓ pass                                                                           |
| `npm run build`                                  | ✓ pass (15 rutas — 7 estáticas, 8 dinámicas)                                     |
| `npm run size:check`                             | ✓ pass (`/login` 71.9%, `/inicio` 28.0% del budget gzip)                         |
| `export const runtime = 'edge'` en algún archivo | ✓ ninguno (cumple CLAUDE.md regla 4)                                             |
| `any` sin justificación en `src/`                | ✓ ninguno (cumple regla 7)                                                       |
| Storage APIs para tokens                         | ✓ no se usan (cumple regla 6)                                                    |
| Tipos auto-generated `src/lib/api/types.ts`      | ⚠ no regenerado en este ciclo — sin endpoints nuevos en backend que cubran C0-15 |
| Sidebar `visibleFor` typing                      | ✓ `ReadonlyArray<UserRole>` consistente con Anexo C.4                            |
| Mapping rol → label es-CL                        | ✓ `role-labels.ts` cubierto por test (3 tests)                                   |

**Nota sobre types.ts:** `qavante-api` aún no expone `/api/users`, `/api/auth/accept-invitation`, `/api/me` en `openapi.json`. La UI C0-15 compila contra tipos **hand-rolled en `src/lib/api/users.ts`** alineados al contrato declarado en `docs/backend-contracts/c0-auth-and-users.md § 3`. Cuando backend baje los endpoints, hay que `npm run generate:api` y reemplazar los tipos manuales por los del schema OpenAPI — pieza explícita del unblock de qavante-api C0-14.

---

## #5 — DoD por ticket

| Ticket  | DoD                                                            | Estado                                                                                                                                 |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| C0-14   | Backend `qavante-api`: `/api/users` CRUD + accept-invitation   | ✗ **bloqueado en repo backend** (cross-repo). FE compila contra contrato, espera unblock.                                              |
| C0-15   | `/app/administracion/usuarios` tabla con 5 cols + acciones     | ✓ TanStack Table, cols nombre/email/rol/estado/último login/acciones (`src/components/administracion/users-table.tsx`)                 |
| C0-15   | Botón "Invitar usuario" → modal email + selector de rol        | ✓ `invite-user-dialog.tsx` con react-hook-form + zod                                                                                   |
| C0-15   | Acción "Cambiar rol" inline                                    | ✓ `role-select.tsx` native con styling Qavante                                                                                         |
| C0-15   | Acción "Suspender" con confirm dialog                          | ✓ `suspend-user-dialog.tsx` (sirve también para reactivar según `user.status`)                                                         |
| C0-15   | Estado vacío con CTA "Invita al primer usuario"                | ✓ `QavanteEmpty` en `page.tsx`                                                                                                         |
| C0-15   | Sólo visible para admin u owner                                | ✓ sidebar gate (PR #48) — `visibleFor: ["owner", "admin", "technical_admin"]` (Anexo C.4)                                              |
| C0-15   | Ruta `/aceptar-invitacion?token=xxx` con form de clave inicial | ✓ `(auth)/aceptar-invitacion/page.tsx` + `form.tsx`, validación zod, copys del Anexo C.3                                               |
| C0-16   | Backend RBAC dependency aplicado                               | ✗ **bloqueado en repo backend** (cross-repo)                                                                                           |
| C0-17   | RLS staging                                                    | ✗ **bloqueado en repo backend** (cross-repo)                                                                                           |
| C0-18   | README ambos repos completos                                   | ⚠ FE `qavante-web` README actualizado (Milestone D status + link CHANGELOG). BE `qavante-api` README no auditable desde acá.           |
| C0-18   | CONTRIBUTING.md ambos repos                                    | ⚠ FE OK (PR #37 + ajuste en PR #49). BE no auditable desde acá.                                                                        |
| C0-18   | `docs/ARCHITECTURE.md` con diagrama                            | ✓ existe (PR #37)                                                                                                                      |
| C0-18   | `CHANGELOG.md`                                                 | ✓ Keep a Changelog 1.1.0 — 5 releases pre-v1.0 desde [0.3.0] hasta [Unreleased] (PR #50)                                               |
| C0-18   | Demo grabada                                                   | ✗ **pendiente — manual de Fernando** (5-10 min: login → navegar 6 módulos → invitar usuario → suspender usuario)                       |
| C0-18   | Tag `c0-complete-2026-MM-DD`                                   | ✗ **pendiente — manual de Fernando** (último paso del Sprint, tras demo y cierre de PRs C0)                                            |
| DoD 5.2 | Lighthouse mobile ≥85 en `/login`                              | ✓ automatizado en CI (job `lighthouse` desde PR #49) — 3 runs sobre Pixel 4 emulation, slow 4G, 4x CPU. Hard assert en `lhci autorun`. |
| DoD 5.2 | Lighthouse mobile ≥90 en `/app/inicio`                         | ⚠ diferido hasta cookie cross-origin (qavante-api#58) — sin cookie, redirige 307 a `/login` y mediría la página equivocada             |
| DoD 5.2 | Bundle size budgets `/login` y `/inicio`                       | ✓ `scripts/check-bundle-size.mjs` en CI (PR #39) — `/login` 71.9%, `/inicio` 28.0%                                                     |

---

## #6 — Documentación

- **CHANGELOG.md (nuevo, PR #50)** — Keep a Changelog 1.1.0. Versionado semántico no estricto pre-v1.0:
  - `[Unreleased]` con in-flight + cross-team + cierre pendiente (al momento de #50).
  - `[0.6.0] 2026-05-13` Milestone D parcial + anti-patching.
  - `[0.5.0] 2026-05-12` Milestone C.
  - `[0.4.0] 2026-05-11` Milestone B.
  - `[0.3.0] 2026-05-10` Milestone A.
  - Cubre la deuda 🟢 #9 del audit ABC.
  - **Acción de este PR**: bump `[Unreleased]` → `[0.7.0] 2026-05-13` con los 4 PRs ya mergeados, `[Unreleased]` queda con sólo demo + tag + cross-team pendientes.

- **README.md** — Milestone D ⏳ → 🟡 (PR #50) → ✅ (este PR). Sección Documentación linkea CHANGELOG.md.

- **CONTRIBUTING.md** — checklist DoD por PR actualizado: Lighthouse pasa de "verificar manual" a "automatizado en CI" para `/login` (PR #49). Cubre la deuda 🟡 #5 del audit ABC.

- **ARCHITECTURE.md** — vigente desde PR #37 (Milestone D parcial), no requiere update para Milestone D close.

- **ADRs** — sin ADRs nuevos en Milestone D. ADR-0004 (anti-patterns Asistente, PR #35) preventivo para C2, no afecta cierre.

- **Comentarios inline** — razonables. Notable:
  - `src/lib/auth/session.ts` sigue con placeholder `role: "owner"` documentado (audit ABC ya lo señaló). Cuando qavante-api `/api/me` baje, `auth()` retornará rol real y el sidebar gate de PR #48 empezará a esconder Administración para `viewer`/`accountant` reales.
  - `src/components/administracion/users-table.tsx`: pasthrough de fechas con `date-fns` locale es-CL — formato consistente con el resto del Anexo F.

---

## #7 — Lighthouse mobile (production build)

CI job `lighthouse` (`.github/workflows/ci.yml`) ejecuta `lhci autorun` con:

- form factor mobile (Pixel 4 — 412×823 dpr 1.75)
- throttling: 4x CPU slowdown, slow 4G (RTT 150ms, 1638.4 kbps)
- 3 runs (mediana)
- assertion: `categories:performance ≥ 0.85` (error/DoD), accessibility/best-practices ≥ 0.9 (warn)

**Resultado en main (run del PR #49, commit 8c56e14):**

| Ruta      | Perf  | Status                                                                                                                                                                                          |
| --------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`  | ≥85 ✓ | `lhci autorun` exitcode 0 → assertion `performance ≥ 0.85` pass. Reporte público: `https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1778668896512-7590.report.html` |
| `/inicio` | n/a   | diferido por #1 (auth cookie). Re-incluir cuando qavante-api#58 baje + seed de cookie de prueba pre-lighthouse                                                                                  |

Comparación vs audit ABC (2026-05-12 local Chrome): `/login` 79 → ≥85 en CI. Ganancia de los anti-patching y bundle-budget intermedios. Margen real más alto en hardware no compartido — el runner CI siempre castiga.

---

## Recomendaciones por severidad

### 🔴 Crítico

Ninguno.

### 🟡 Medio

1. **`/app/administracion/usuarios` First Load = 199 kB raw** (sin gzip, no aparece en `size:check` porque el script sólo audita `/login` y `/inicio`). Está en el borde del budget 200 kB declarado. **Acción**: agregar `/app/administracion/usuarios: 200` a `BUDGETS_KB` de `scripts/check-bundle-size.mjs` o aceptar como deuda admin-only (no impacta a usuarios típicos PYME). Probablemente lo segundo — la página la ve sólo owner/admin/technical_admin.

### 🟢 Menor

2. **Lighthouse `/app/inicio`** — no auditable hasta cookie cross-origin. Follow-up natural: cuando qavante-api#58 baje, agregar URL al `.lighthouserc.json` + script de seed de cookie pre-lighthouse.
3. **`src/lib/api/users.ts` con tipos hand-rolled** — cuando backend exponga `/api/users`, regenerar via `npm run generate:api` y reemplazar por tipos del schema OpenAPI.

---

## Checklist Anexo K.4 — los 7 puntos

1. **Inventario** ✓ — `git diff --stat dce49a7..HEAD`, 23 archivos, +4 389 / −268 LoC.
2. **Tests pasando** ✓ — 3 unit + 16 e2e + size:check + smoke prod.
3. **Sin regresiones** ✓ HTTP-level (12 rutas verificadas en e2e). ⚠ visual mobile/sidebar gate por session.role real queda para Fernando antes de la demo.
4. **Coherencia** ✓ — typecheck/lint/build/size:check verdes, sin Node-only, sin `any`, sin Storage APIs.
5. **DoD** ✓ — items en este repo cubiertos. Cross-repo (C0-14/16/17) bloqueados en qavante-api. Items manuales (demo, tag) pendientes Fernando.
6. **Documentación** ✓ — CHANGELOG/README/CONTRIBUTING/ARCHITECTURE alineados al estado actual.
7. **Lighthouse mobile** ✓ /login ≥85 en CI. ⚠ /app/inicio diferido.

**Veredicto:** Milestone D listo en lo que `qavante-web` puede entregar. Cierre formal del Sprint C0 depende de:

- **Fernando manual:** demo grabada (5-10 min), tag `c0-complete-2026-05-XX`.
- **Cross-team (no bloquea C0 en este repo):** qavante-api endpoints C0-14, RBAC C0-16, RLS C0-17, cookie cross-origin #58, `fly certs create api.qavante.com`.

---

## Apéndice — comandos para reproducir el audit

```bash
# Inventario
git diff --stat dce49a7..HEAD
git diff --name-status dce49a7..HEAD
git log --oneline dce49a7..HEAD

# Tests
npm run typecheck && npm run lint
npm run test
npx playwright install --with-deps chromium
npm run e2e

# Coherencia y bundle budget
npm run build
npm run size:check
grep -rn "export const runtime" src/

# Lighthouse en CI (no local en Windows por EPERM en Chrome temp dir)
gh run view <RUN_ID> --log | grep -E "Lighthouse|Run #|Done|categories"

# Smoke prod
npm run smoke
```

---

Generated by CC-WEB — 2026-05-13.
