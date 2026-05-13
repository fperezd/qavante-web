# Changelog

Todos los cambios notables de `qavante-web` se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado **semántico no estricto** durante el Sprint C0 (pre-v1.0): cada Milestone bumpea el `minor` con la fecha del cierre. El Sprint C0 se cerrará con tag `c0-complete-YYYY-MM-DD` (Kit C0-18 DoD).

## [Unreleased]

### Pendiente cierre Sprint C0 (manual de Fernando)

- Demo interna grabada (5–10 min): login → navegar 6 módulos → invitar usuario → suspender usuario.
- Tag de release `c0-complete-YYYY-MM-DD` desde `main` cuando los items manuales estén.

### Pendiente cross-team (no bloquea cierre C0 en `qavante-web`)

- **qavante-api#58 + ADR-0003**: cookie de sesión cross-origin (`SameSite=None; Secure`) funcional → desbloquea `useSession`, login real end-to-end, Lighthouse para `/app/inicio` con seed de cookie.
- **qavante-api C0-14**: implementar `GET/POST /api/users`, `PATCH /api/users/{id}`, `POST /api/auth/accept-invitation` (contrato listo en frontend). Cuando bajen: regenerar `src/lib/api/types.ts` vía `npm run generate:api` y reemplazar tipos hand-rolled de `src/lib/api/users.ts`.
- **qavante-api C0-16**: RBAC dependency sobre endpoints existentes.
- **qavante-api C0-17**: RLS staging.
- **`fly certs create api.qavante.com`** (Fernando — IaC manual).

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
