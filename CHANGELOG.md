# Changelog

Todos los cambios notables de `qavante-web` se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado **semántico no estricto** durante el Sprint C0 (pre-v1.0): cada Milestone bumpea el `minor` con la fecha del cierre. El Sprint C0 se cerrará con tag `c0-complete-YYYY-MM-DD` (Kit C0-18 DoD).

## [Unreleased]

### En curso (Milestone D — Admin mínima + cierre)

- **C0-15 — Frontend Administración → Usuarios** (PR [#44](https://github.com/fperezd/qavante-web/pull/44)): tabla TanStack con cols nombre/email/rol/estado/último login, modal "Invitar usuario", inline edit de rol, suspender/reactivar con confirm, ruta pública `/aceptar-invitacion?token=xxx` con form de clave inicial. UI compila contra contrato de [docs/backend-contracts/c0-auth-and-users.md](./docs/backend-contracts/c0-auth-and-users.md) § 3; renderea error state hasta que `qavante-api` C0-14 (`/api/users`, `/api/auth/accept-invitation`) esté arriba.
- **C0-15 — Sidebar gate** (PR [#48](https://github.com/fperezd/qavante-web/pull/48)): módulo "Administración" oculto en sidebar para roles sin permiso (Anexo C.4 — `viewer`/`accountant` no ven). Cierra el último checkbox de DoD C0-15.
- **C0 — Lighthouse CI mobile en /login** (PR [#49](https://github.com/fperezd/qavante-web/pull/49) / issue #41): gate de performance ≥85 mobile en `/login` (Kit DoD sec 5.2). `/app/inicio` diferido hasta unblock de cookie cross-origin (qavante-api#58).
- **C0-18 — CHANGELOG + README** (este PR / issue #45): tercer deliverable parcial de C0-18.

### Pendiente cross-team

- **qavante-api#58 + ADR-0003**: cookie de sesión cross-origin (`SameSite=None; Secure`) funcional → desbloquea `useSession`, login real end-to-end, Lighthouse para `/app/inicio` con seed.
- **qavante-api C0-14**: implementar `GET/POST /api/users`, `PATCH /api/users/{id}`, `POST /api/auth/accept-invitation` (contrato listo en frontend).
- **`fly certs create api.qavante.com`** (Fernando — IaC manual).

### Pendiente cierre C0-18

- Demo interna grabada (5–10 min): login, navegar módulos, invitar usuario, suspender usuario.
- Revisión integral end-to-end del Anexo K.4 sobre Milestone D.
- Tag de release `c0-complete-YYYY-MM-DD`.

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

[unreleased]: https://github.com/fperezd/qavante-web/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/fperezd/qavante-web/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/fperezd/qavante-web/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/fperezd/qavante-web/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fperezd/qavante-web/releases/tag/v0.3.0
