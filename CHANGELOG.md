# Changelog

Todos los cambios notables de `qavante-web` se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado **semántico no estricto** durante el Sprint C0 (pre-v1.0): cada Milestone bumpea el `minor` con la fecha del cierre. El Sprint C0 se cerrará con tag `c0-complete-YYYY-MM-DD` (Kit C0-18 DoD).

## [Unreleased]

### En curso (C1 prep — sin dependencias `qavante-api`)

Ciclo autónomo 2026-05-13 → 2026-05-16 con autorización owner. Adelanta el frontend de tickets que dependen de backend bloqueado, todos mockeados con MSW (ver ADR-0005). Incluye cierre del Design System (Storybook + Chromatic), audit K.4 del ciclo, runbooks de handoff cross-agente y formalización del Addendum Frontend v2.0.

#### Added

- **C1 prep — MSW v2 setup** ([#55](https://github.com/fperezd/qavante-web/pull/55), ADR-0005) — Mock Service Worker con triple guard contra activación en prod. Handlers para auth + users alineados a contrato C0. 11 sanity tests nuevos.
- **C1 prep — Contrato SII credentials** ([#58](https://github.com/fperezd/qavante-web/pull/58), [`docs/backend-contracts/c1-sii-credentials.md`](./docs/backend-contracts/c1-sii-credentials.md)) — 6 endpoints documentados (empresa + personas + certificado digital PKCS#12) con 10 restricciones de seguridad no-negociables.
- **C1 prep — UI Administración → Credenciales SII** ([#59](https://github.com/fperezd/qavante-web/pull/59)) — `/app/administracion/credenciales` con 3 cards (Empresa + Personas + Certificado) + 7 componentes nuevos. Handlers MSW para los 6 endpoints. 9 tests sanity. ADR-0006 (Deferred) registra decisiones backend pendientes (KMS / storage / audit).
- **Mobile responsive Playwright spec** ([#60](https://github.com/fperezd/qavante-web/pull/60), audit K.4 #3) — `playwright.config.ts` refactor a 2 projects (`http` + `mobile`). 4 specs cubriendo rutas públicas en viewport Pixel 5 con check anti-overflow horizontal.
- **A11y improvements (skip link + aria-current + landmark labels)** ([#64](https://github.com/fperezd/qavante-web/pull/64)) — `SkipLink` component, `aria-current="page"` en sidebar links activos, `aria-label`s en aside/main/breadcrumbs. Mejora SR navigation sin cambios visuales.
- **Unit tests para `format.ts` + `expiration-banner` extraídos** ([#65](https://github.com/fperezd/qavante-web/pull/65)) — extracción de helpers de `certificate-card.tsx` a módulos testables: `format.ts` (formatDateEsCL, daysUntilExpiration) + `expiration-banner.ts` (tone calc). 13 tests anti-regresión.
- **Unit tests para `isValidRut` + `apiErrorToUserMessage`** ([#67](https://github.com/fperezd/qavante-web/pull/67)) — 13 + 15 tests cubren validación RUT chileno (DV módulo 11) + mapping Anexo C.3 de error técnicos a copys usuario.
- **Tech-debt issues registrados**: [#56](https://github.com/fperezd/qavante-web/issues/56) (SSO Google/MS deferred a Fase 2) + [#68](https://github.com/fperezd/qavante-web/issues/68) (Playwright + MSW combo mobile para rutas protegidas) + [#69](https://github.com/fperezd/qavante-web/issues/69) (Storybook setup deferred) + [#71](https://github.com/fperezd/qavante-web/issues/71) (cross-repo handoff backend SII).
- **Playwright + MSW combo para rutas protegidas mobile** ([#73](https://github.com/fperezd/qavante-web/pull/73), cierra [#68](https://github.com/fperezd/qavante-web/issues/68)) — `protected-routes.mobile.spec.ts` (Pixel 5) sobre `/app/*` con cookie injection + `qavante_test_role` + `NEXT_PUBLIC_TEST_MODE=playwright` (cuarto guard MSW para builds prod de Playwright). 5 specs.
- **Lighthouse mobile en `/administracion/credenciales`** ([#75](https://github.com/fperezd/qavante-web/pull/75)) — primera ruta protegida en el gate Lighthouse (cookie dummy vía `extraHeaders`, sin MSW → mide bundle real del shell `(app)`). Threshold 0.85.
- **Storybook 10 — Design System Qavante** ([#77](https://github.com/fperezd/qavante-web/pull/77) Capa 1, [#78](https://github.com/fperezd/qavante-web/pull/78) Capa 2, cierra [#69](https://github.com/fperezd/qavante-web/issues/69)) — `@storybook/nextjs-vite`, 19 componentes / ~80 stories (6 Capa 1 design system + 13 Capa 2 admin/credenciales). Co-located `*.stories.tsx`. Addons `addon-a11y` + `addon-docs`. `storybook-static/` gitignored, fuera del bundle Cloudflare.
- **Storybook tests vía Vitest** ([#81](https://github.com/fperezd/qavante-web/pull/81)) — `vitest.config.ts` a `projects[]`: proyecto `unit` (74 tests, rápido) + proyecto `storybook` (86 tests browser Chromium vía `@vitest/browser-playwright`). `npm run test` queda en `unit`; `test:storybook` opt-in + job CI separado. Playwright alineado a 1.60.0 (fix mismatch de browser revision).
- **Chromatic visual regression** ([#79](https://github.com/fperezd/qavante-web/pull/79) setup, [#88](https://github.com/fperezd/qavante-web/pull/88) anti-flakiness) — workflow `chromatic.yml` gated por secret, baseline de 86 snapshots operativo. Config anti-flakiness (`pauseAnimationAtEnd`/`delay`/`diffThreshold`) elimina falsos positivos de stories con `animate-spin`.
- **Audit K.4 del ciclo c1-prep** ([#76](https://github.com/fperezd/qavante-web/pull/76), [`docs/audits/c1-prep-review.md`](./docs/audits/c1-prep-review.md)) — revisión integral: 0 críticos, 1 medio (backend bloqueado), 5 menores. Suite verde.
- **Runbook handoff cross-agente SII** ([#82](https://github.com/fperezd/qavante-web/pull/82), [`docs/backend-contracts/c1-sii-handoff-runbook.md`](./docs/backend-contracts/c1-sii-handoff-runbook.md)) — procedimiento de 6 pasos CC-WEB↔CC-API con Fernando de puente + brief listo + plan de integración FE post-handoff.
- **Formalización Addendum Frontend v2.0 + reconciliación CTO** ([#83](https://github.com/fperezd/qavante-web/pull/83)) — `.docx` binario de la raíz → [`docs/addendum/frontend-v2.md`](./docs/addendum/frontend-v2.md) (transcripción fiel) + [`reconciliation.md`](./docs/addendum/reconciliation.md) resolviendo P0 (backend no expone endpoints — verificado contra OpenAPI prod) + 4 contradicciones P1 (gana repo/CLAUDE.md).
- **ADR-0007/0008/0009** ([#86](https://github.com/fperezd/qavante-web/pull/86)) — estructura de carpetas dominios addendum (no `src/features/`), feature flags gating, política drag-and-drop preventiva.
- **Brief 2º handoff backend (taxonomía/gestión/multimoneda)** ([#87](https://github.com/fperezd/qavante-web/pull/87), [`docs/addendum/taxonomy-handoff-brief.md`](./docs/addendum/taxonomy-handoff-brief.md)) — handoff de co-diseño para CC-API (contrato NO existe, a diferencia de SII). 7 dominios priorizados + 6 decisiones que CC-API debe resolver.
- **Verificación dura OpenAPI prod 2026-05-16 + P3/P4 reconciliación** ([#93](https://github.com/fperezd/qavante-web/issues/93)) — `reconciliation.md` P3 (datos del Addendum Técnico Escalamiento: `canonical_category` enum 16 valores, syncs async-task) + **P4** (verificación `curl /openapi.json`: 73 paths, mayor parte de taxonomía/gestión **LIVE**, P0 invertido). Documenta el **drift de credenciales SII** (`admin/sources` genérico vs contrato `/credentials/sii`) como decisión pendiente de Fernando (regla 16 — no se parchea en silencio). **P4-4 revierte P3-1**: el contrato vivo de `canonical_category` es la taxonomía de 26 valores del addendum §11 con labels (`CanonicalCategoryMeta`, §10.1), no el enum de 16 de migration 0026 (ausente del API público) — contradicción doc-backend ↔ API-vivo ruteada a CC-API. `taxonomy-handoff-brief.md` DoD + §4 actualizados a estado parcial/corregido.
- **Feature-flags módulo (ADR-0008)** ([#96](https://github.com/fperezd/qavante-web/pull/96)) — `src/lib/feature-flags.ts`: 7 flags tipados, default seguro `false`, override env `NEXT_PUBLIC_FF_*` (ignorado en prod), seam `config` inyectable para el futuro `GET /api/management/config` (ausente — verificado 2026-05-16). 12 unit tests. CONTRIBUTING + nota de estado en ADR-0008. Sin integración real (patrón, no datos).
- **Esqueletos de ruta gateados + FeatureUnavailableState** ([#107](https://github.com/fperezd/qavante-web/pull/107), reemplazó al auto-cerrado #98) — 5 rutas Server Component gateadas por flag OFF (`/administracion/{estructura-gestion,vistas-gestion,monedas,reglas-clasificacion}` + `/caja/por-clasificar`, addendum §14-§18) + `FeatureUnavailableState` (wrapper de `QavanteEmpty`, §20/§23.1) + story + links en landing Administración (sidebar plano, §9.1). Sin `export const runtime`, sin deps, sin tocar nav/rutas existentes.
- **Selectores presentacionales de clasificación** ([#100](https://github.com/fperezd/qavante-web/pull/100)) — `src/components/clasificacion/`: `CanonicalCategorySelect` (§17.2/§20), `ManagementAccountSelect` (árbol+search, §20), `DimensionValuePicker` (respeta `allowsMultiple`, §15.5) — prop-driven puros, sin fetch/tipos generados. Helper `filter.ts` (substring, acento-insensible) + 6 tests. Fixtures de stories fundadas en el contrato vivo §11/26. 8 stories Capa 2.
- **ClassificationDrawer — shell presentacional** ([#108](https://github.com/fperezd/qavante-web/pull/108), reemplazó al auto-cerrado #102) — drawer §17.2 que compone los 3 selectores; estado de formulario local, emite `ClassificationDraft` por callbacks (sin mutación/fetch). Resumen read-only (§17.4). A11y: `role=dialog`+`aria-modal`+Esc+focus management WCAG. 3 stories.
- **ADR-0010 — selectores sin librería combobox** ([#106](https://github.com/fperezd/qavante-web/pull/106)) — formaliza la decisión dependency-free (input + lista nativa accesible), evaluación de combobox diferida y condicionada (análogo a ADR-0009/DnD) + invariantes de a11y (no anidar interactivos en `role=listbox`).
- **Audit K.4 del ciclo addendum-skeleton** ([#104](https://github.com/fperezd/qavante-web/pull/104), [`docs/audits/addendum-skeleton-cycle-review.md`](./docs/audits/addendum-skeleton-cycle-review.md)) — revisión integral sobre rama de integración: 0 críticos, 2 escalamientos 🟡 a Fernando (drift SII P4-2, `canonical_category` P4-4), 1 flake unit transitorio. Suite integrada verde. + adenda post-audit (ADR-0010 + corrección a11y del patrón ARIA en selectores/drawer antes de merge).

> **Estado al cierre del ciclo (2026-05-16):** los 7 PRs anteriores **mergeados a `main`**; suite verde en `main` real (typecheck/lint/92 unit/build/size/100 storybook). Todo aditivo y gateado OFF — **`generate:api` e integración real siguen DEFERIDOS** hasta resolver las 2 decisiones (drift credenciales SII P4-2 + `canonical_category` doc-backend vs API-vivo P4-4, ver [`reconciliation.md`](./docs/addendum/reconciliation.md)).
>
> **Actualización 2026-05-17:** **P4-4 ✅ RESUELTO** por CC-API (R-2, ratificado por Fernando): gana la taxonomía §11/26 congelada; la lista de 16 (AD-ESC #6) descartada formalmente (nunca existió la migración). Cero rework FE. CC-API publicó el OpenAPI formal de taxonomía. **P4-2 ✅ DECIDIDO** (Fernando, Opción 1): el FE se adapta al modelo genérico `/api/admin/sources/*` (superset verificado del contrato SII; `c1-sii-credentials.md` queda superseded). **Ambos gates resueltos** → `generate:api` desbloqueado (verificado: nada importa `types.ts`, regenerar es aditivo y no rompe build). Pendiente acotado a CC-API: representación multi-persona SII. Próximo: integración real (taxonomía) detrás de feature flags.

#### Changed

- **Bundle budget `/admin/usuarios` reducido vía dynamic imports** ([#61](https://github.com/fperezd/qavante-web/pull/61), audit K.4 #2) — dialogs `Invite/Suspend/SiiPerson/CertUpload/DeleteConfirm` ahora son `next/dynamic` con `ssr: false`. **First Load JS gzip: 194 → 146 KB (-25%, -48 KB)** sobre `/admin/usuarios`. Sin impacto UX.
- **`docs/ARCHITECTURE.md` + `CONTRIBUTING.md`** ([#62](https://github.com/fperezd/qavante-web/pull/62)) — nueva sección "Dev environment + testing" con tabla de 7 capas de testing CI (unit/E2E HTTP/E2E mobile/type/lint/bundle/lighthouse/secrets). Actualiza endpoints mockeados (auth + users + SII). Documenta patrón anti-overflow para futuros mobile specs.
- **Bundle budget `/aceptar-invitacion` agregado a `size:check`** ([#66](https://github.com/fperezd/qavante-web/pull/66)) — la ruta pública de aceptación de invitación entra al gate CI con su propio budget. Cubre regresión potencial al agregar dependencias al flow de claim invitation.

#### Fixed

- **`config_missing` reachable en `apiErrorToUserMessage`** ([#72](https://github.com/fperezd/qavante-web/pull/72), [#70](https://github.com/fperezd/qavante-web/issues/70)) — `isNetworkError()` (status===0) ganaba al switch `err.code`, volviendo unreachable la rama `case "config_missing"`. Reordenado: switch sobre code antes que network. Un dev sin `NEXT_PUBLIC_API_URL` ahora ve el mensaje técnico "NEXT_PUBLIC_API_URL no configurada" en vez de "perdiste conexión".

### Pendiente cierre Sprint C0

- Tag de release `c0-complete-YYYY-MM-DD` desde `main` (manual de Fernando, último paso del Sprint).

### Pendiente cross-team (no bloquea cierre C0 en `qavante-web`)

- **qavante-api#58 + ADR-0003**: cookie de sesión cross-origin (`SameSite=None; Secure`) funcional → desbloquea `useSession`, login real end-to-end, Lighthouse para `/app/inicio` con seed de cookie.
- **qavante-api C0-14**: implementar `GET/POST /api/users`, `PATCH /api/users/{id}`, `POST /api/auth/accept-invitation` (contrato listo en frontend). Cuando bajen: regenerar `src/lib/api/types.ts` vía `npm run generate:api` y reemplazar tipos hand-rolled de `src/lib/api/users.ts`.
- **qavante-api C0-16**: RBAC dependency sobre endpoints existentes.
- **qavante-api C0-17**: RLS staging.
- **qavante-api C1 prep — DRIFT (2026-05-16)**: el backend **no** expuso los 6 endpoints `/api/credentials/sii` del contrato [`c1-sii-credentials.md`](./docs/backend-contracts/c1-sii-credentials.md); shipeó un modelo genérico `/api/admin/sources/{source_code}/credential|test|consent|sync-config`. **Decisión pendiente de Fernando** (reconciliation.md P4-2): FE se adapta a `admin/sources` vs. backend vuelve al contrato. Bloquea `generate:api` e ingesta sii_f29/previred de Sprint C1. Runbook: [`c1-sii-handoff-runbook.md`](./docs/backend-contracts/c1-sii-handoff-runbook.md).
- **qavante-api 2º handoff — taxonomía/gestión/multimoneda — MAYORMENTE DESTRABADO (2026-05-16)**: verificación dura del OpenAPI de prod (73 paths) confirma **LIVE** canonical-categories, management/accounts(+tree+move+toggles), dimensions(+values+assignments), bank-movements/classify, SII f29 ingesta. **Faltan 3 dominios**: industry-templates, currencies, classification-rules (+ `suggest-rule`, `/management/config`). Detalle en [`reconciliation.md`](./docs/addendum/reconciliation.md) P4. Trabajo FE sin más backend (feature-flags OFF, esqueletos, componentes presentacionales) habilitado; integración real de datos espera decisión drift SII + confirmación oficial del handoff.
- **`fly certs create api.qavante.com`** (Fernando — IaC manual).
- **Aceptar baseline Chromatic** (Fernando — UI web): aceptar una vez los diffs históricos en chromatic.com para limpiar el baseline. Falsos positivos por flakiness ya mitigados de raíz en [#88](https://github.com/fperezd/qavante-web/pull/88).

## [0.7.0] — 2026-05-13

### Milestone D — Admin mínima + cierre del Sprint C0 (parte FE)

Cierre del frontend de Administración + gate de performance automatizado + documentación de release. Cubre todo lo que `qavante-web` puede entregar para C0-15 y C0-18; los tickets cross-repo (C0-14/16/17) quedan a cargo de `qavante-api`.

#### Added

- **C0-15 — Frontend Administración → Usuarios** ([#44](https://github.com/fperezd/qavante-web/pull/44)) — tabla TanStack con cols nombre/email/rol (inline edit)/estado/último login (`date-fns` es-CL)/acciones. Modal "Invitar usuario" (`react-hook-form` + `zod`), suspender/reactivar con confirm, estado vacío con CTA, mapping de errores Anexo C.3 (`email_already_exists`, `invitation_already_pending`, `last_owner_protection`). Ruta pública `/aceptar-invitacion?token=xxx` con form de clave inicial. UI compila contra contrato `docs/backend-contracts/c0-auth-and-users.md § 3`; rinde error state hasta que `qavante-api` C0-14 esté arriba.
- **C0-15 — Sidebar gate** ([#48](https://github.com/fperezd/qavante-web/pull/48)) — módulo "Administración" oculto en sidebar para roles sin permiso (`visibleFor: ["owner", "admin", "technical_admin"]`, Anexo C.4). Cierra el último checkbox de DoD C0-15.
- **Lighthouse CI mobile en /login** ([#49](https://github.com/fperezd/qavante-web/pull/49) / issue #41) — job `lighthouse` en `.github/workflows/ci.yml`: `lhci autorun` con 3 runs sobre Pixel 4 emulation (412×823, dpr 1.75), slow 4G throttling (RTT 150ms, 1638.4 kbps), 4x CPU slowdown. Assert hard `performance ≥0.85` (Kit DoD sec 5.2), warn `accessibility/best-practices ≥0.9`. Upload de artifacts `.lighthouseci/` retención 7 días.
- **CHANGELOG.md inicial** ([#50](https://github.com/fperezd/qavante-web/pull/50) / issue #45) — Keep a Changelog 1.1.0 cubriendo historial completo desde C0-01 ([0.3.0] hasta este [0.7.0]).
- **README — Milestone D status** ([#50](https://github.com/fperezd/qavante-web/pull/50)) — Milestone D ⏳ → 🟡 → ✅ (este PR), link a CHANGELOG en sección Documentación.
- **Audit Anexo K.4 sobre Milestone D** ([docs/audits/c0-milestone-d-review.md](./docs/audits/c0-milestone-d-review.md) — este PR) — revisión integral end-to-end: 0 críticos, 1 medio, 2 menores. Suite verde (3 unit + 16 e2e + size:check + smoke), Lighthouse `/login` ≥85 en CI.

#### Changed

- **CONTRIBUTING.md** ([#49](https://github.com/fperezd/qavante-web/pull/49)) — checklist DoD por PR: línea de Lighthouse pasa de "verificar manual con devtools" a "automatizado en CI" para `/login`.
- **README — Milestone D 🟡 → ✅** (este PR) — todo lo que dependía de `qavante-web` está mergeado; quedan items manuales (demo, tag) + cross-team blockers documentados en `[Unreleased]`.

## [0.6.0] — 2026-05-13

### Milestone D parcial + anti-patching

Endurecimiento del repo previo al cierre del Sprint C0. Sin features nuevas — todo es infra, docs y guardrails.

#### Added

- **Bundle size budget en CI** ([#39](https://github.com/fperezd/qavante-web/pull/39)) — `scripts/check-bundle-size.mjs` corre en CI tras `next build` y revienta el job si `/login` o `/app/inicio` superan los budgets de Kit DoD sec 5.2.
- **Smoke test post-deploy** ([#29](https://github.com/fperezd/qavante-web/pull/29)) — `playwright.smoke.config.ts` + `tests/e2e/prod-health.smoke.spec.ts` corriendo contra `app.qavante.com` para validar deploys reales (no sólo build local).
- **ARCHITECTURE.md + CONTRIBUTING.md** ([#37](https://github.com/fperezd/qavante-web/pull/37)) — primer pase: diagrama Cloudflare Workers ↔ API Fly + convenciones de branching, conventional commits, PR template, DoD.
- **ADR-0004 — anti-patterns del Asistente Qavante** ([#35](https://github.com/fperezd/qavante-web/pull/35)) — registro preventivo de patrones a evitar en C2.
- **IaC ops versionado** ([#33](https://github.com/fperezd/qavante-web/pull/33)) — `docs/operations/cloudflare-dns.md` (registros DNS de `qavante.com`) + `docs/operations/github-secrets.md` (secrets versionados como inventario, no contenido).
- **Versionado de custom domain** ([#27](https://github.com/fperezd/qavante-web/pull/27)) — `wrangler.toml` declara `routes` para `app.qavante.com` (deploy declarativo, no clicks en UI).
- **Audit Anexo K.4 de Milestones A/B/C** ([#19](https://github.com/fperezd/qavante-web/pull/19)) — revisión integral previa a Milestone D documentada en `docs/audits/c0-milestone-abc-review.md`.

#### Changed

- **Documento Maestro v2.6.3 → v2.6.4** ([#23](https://github.com/fperezd/qavante-web/pull/23)) — dominio definitivo `qavante.com` (app en `app.qavante.com`) reemplaza `qavante.cl` del v2.6.3.
- **Kit + backend-contract + workflow alineados a `app.qavante.com`** ([#40](https://github.com/fperezd/qavante-web/pull/40)) — limpia las últimas referencias a hosts viejos.

#### Fixed

- **C0-02 alineado a Cloudflare Workers (no Pages)** ([#21](https://github.com/fperezd/qavante-web/pull/21)) — repo apuntaba a Pages en docs/config; consolidado a Workers via `@opennextjs/cloudflare` para coherencia con ADR-0001.
- **C0-13 middleware movido a `src/`** ([#20](https://github.com/fperezd/qavante-web/pull/20)) — `next.config` busca middleware en `src/` cuando `srcDir` está activo. Cobertura e2e (`tests/e2e/auth-redirect.spec.ts`) contra regresión.

## [0.5.0] — 2026-05-12

### Milestone C — Auth y conexión backend

Frontend listo para hablar con `qavante-api`. Endpoints reales del backend quedaron como dependencia cross-repo (C0-11, C0-14).

#### Added

- **API client tipado** ([#12](https://github.com/fperezd/qavante-web/pull/12), C0-10) — `src/lib/api/client.ts` contra FastAPI con interceptor 401 → redirect a `/login`. Types auto-generados desde OpenAPI (`npm run generate:api` → `src/lib/api/types.ts`).
- **Pantalla de login completa** ([#13](https://github.com/fperezd/qavante-web/pull/13), C0-12) — `/login` con form RUT + clave, validación zod, integración API client, mapping de errores Anexo C.3.
- **Middleware de protección de rutas** ([#14](https://github.com/fperezd/qavante-web/pull/14), C0-13) — `middleware.ts` redirige a `/login` si no hay cookie `qavante_session` en rutas `/app/*`. Cookies httpOnly únicamente (CLAUDE.md regla 6).
- **Contrato backend cross-repo** ([#18](https://github.com/fperezd/qavante-web/pull/18), C0-11+C0-14) — `docs/backend-contracts/c0-auth-and-users.md` con shapes esperados de `/api/auth/login`, `/api/auth/logout`, `/api/me`, `/api/users` (CRUD), `/api/auth/accept-invitation`. Acordado para coordinar el unblock con el equipo de backend.

## [0.4.0] — 2026-05-11

### Milestone B — Sistema de diseño y shell

Bases visuales y de navegación. Cero lógica de negocio.

#### Added

- **Sistema de Diseño Qavante — tokens** ([#8](https://github.com/fperezd/qavante-web/pull/8), C0-06) — Anexo B v2.6 mapeado a CSS vars (`src/styles/tokens.css`): color, type scale, radii, spacing, motion.
- **Componentes capa 1** ([#9](https://github.com/fperezd/qavante-web/pull/9), C0-07) — `QavanteButton`, `QavanteInput`, `QavanteCard`, `QavanteBadge`, `QavanteEmpty` sobre shadcn/ui + Base UI.
- **Layout shell global** ([#10](https://github.com/fperezd/qavante-web/pull/10), C0-08) — sidebar con 6 módulos + header con breadcrumb + responsive collapse mobile.
- **6 páginas placeholder con pregunta central** ([#11](https://github.com/fperezd/qavante-web/pull/11), C0-09) — `/app/inicio`, `/app/pulso`, `/app/cobranza`, `/app/proyecciones`, `/app/equipo`, `/app/administracion` rendereando `QavanteEmpty` con la pregunta del Anexo F.

## [0.3.0] — 2026-05-10

### Milestone A — Setup base + CI

Base del repo: Next.js 15 skeleton, Cloudflare Workers, CI mínima.

#### Added

- **Skeleton Next.js 15 + React 19 + TypeScript strict + Tailwind 4** ([#1](https://github.com/fperezd/qavante-web/pull/1), C0-01/C0-02).
- **Prettier + Husky + lint-staged + .editorconfig** ([#15](https://github.com/fperezd/qavante-web/pull/15), C0-04) — guardrails de formato pre-commit.
- **CI paralela con secrets-scan gitleaks** ([#17](https://github.com/fperezd/qavante-web/pull/17), C0-05) — jobs `lint`, `typecheck`, `test`, `build`, `e2e`, `secrets-scan` en `.github/workflows/ci.yml`.
- **README inicial + status C0-02 deploy** ([#4](https://github.com/fperezd/qavante-web/pull/4)).
- **CLAUDE.md alineado a `@opennextjs/cloudflare`** ([#5](https://github.com/fperezd/qavante-web/pull/5)) — regla 4: Workers vía adapter, no Pages.
- **Kit Sprint C0 v1.1 + PR template** ([#6](https://github.com/fperezd/qavante-web/pull/6)).
- **Documento Maestro v2.6.3** ([#7](https://github.com/fperezd/qavante-web/pull/7)) — primera versión alineada a Workers.

#### Fixed

- **CI roja desde el bootstrap** ([#16](https://github.com/fperezd/qavante-web/pull/16)) — puente a C0-05 mientras se resolvía la versión de Node + cache de `npm ci`.

[unreleased]: https://github.com/fperezd/qavante-web/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/fperezd/qavante-web/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/fperezd/qavante-web/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/fperezd/qavante-web/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/fperezd/qavante-web/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fperezd/qavante-web/releases/tag/v0.3.0
