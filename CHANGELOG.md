# Changelog

Sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado conforme avanzan los Sprints C0–C9 del Kit; release oficial de Fase 1 se tagea `c0-complete-YYYY-MM-DD` al cierre del Sprint C0.

## [Unreleased]

> En curso del Sprint C0 — Milestone D y cierre.

### Added

- C0-15 frontend: `/app/administracion/usuarios` (TanStack Table + invitar + cambiar rol + suspender) + ruta pública `/aceptar-invitacion?token=xxx` (PR #44).
- Lighthouse CI mobile en `/login` con preset Pixel 4 + assertion `performance ≥ 0.85` (Kit DoD sec 5.2, PR #42).

### Pendiente del Sprint C0

- **Backend en `qavante-api`** (no scope CC-WEB):
  - C0-11 endpoints auth (`POST /api/auth/{login,refresh,logout}`, `GET /api/me`).
  - C0-14 endpoints User CRUD + `POST /api/auth/accept-invitation`.
  - C0-16 RBAC dependency aplicada a endpoints existentes.
  - C0-17 RLS para segundo tenant en staging.
- **Cross-team:**
  - `fly certs create api.qavante.com` (Fernando manual, ver `qavante-api#58`).
- **CC-WEB follow-up post-BE:**
  - Flip `NEXT_PUBLIC_API_URL` → `https://api.qavante.com` (espera cert + endpoints).
  - Activar `SMOKE_RUT`/`SMOKE_PASSWORD` para gated login flow del smoke (`tests/e2e/prod-health.smoke.spec.ts`).
  - Lighthouse para `/app/inicio` autenticado.
- **C0-18 cierre:**
  - README final post-merges.
  - Demo grabada.
  - Tag `c0-complete-YYYY-MM-DD`.

---

## [0.6.0] — 2026-05-13

Sprint C0 — Milestone D parcial + anti-patching infrastructure.

### Added

- Sistema de **ADRs** en `docs/adr/` con backfill de 4 decisiones clave (ADR-0001 Workers vs Pages, ADR-0002 dominio qavante.com, ADR-0003 api.qavante.com shared parent, ADR-0004 anti-patterns Asistente Qavante) — PRs #31/#35.
- **Smoke test post-deploy** contra `https://app.qavante.com` (3 HTTP-only + 1 browser hidratación + 1 gated login flow) — PR #29.
- **Bundle size budget** en CI: `/login < 200 KB gzip`, `/app/inicio < 400 KB` (Kit DoD sec 5.2) — PR #39.
- **Docs operativos:** `docs/operations/cloudflare-dns.md` (inventario zona qavante.com + runbook recrear-zona-desde-cero) + `docs/operations/github-secrets.md` (CI/CD secrets inventory) — PR #33.
- **CONTRIBUTING.md** consolidando convenciones de branches, commits, PRs y DoD por PR — PR #37.
- **docs/ARCHITECTURE.md** con diagrama Mermaid del flujo cliente Workers → API Fly → Postgres + R2 + servicios externos — PR #37.

### Changed

- **Dominio oficial** migrado de `qavante.cl` a `qavante.com` (GoDaddy + Cloudflare DNS). Frontend en `app.qavante.com`, backend va a `api.qavante.com` cuando el cert se emita (ver ADR-0002 + ADR-0003).
- **Documento Maestro** bumpeado de v2.6.3 → v2.6.4 (`notify@qavante.com`, alineación de versión en CLAUDE.md, src/) — PR #23.
- **Kit Sprint C0** + `docs/backend-contracts/c0-auth-and-users.md` + `.github/workflows/deploy-cloudflare.yml` alineados a `app.qavante.com` (CORS allowlist, link de invitación, login URL, env URL del workflow) — PR #40 (originalmente PR #25, recreada tras auto-cierre por delete de base).
- Custom domain `app.qavante.com` movido del dashboard de Cloudflare a `wrangler.toml` declarativo (IaC) — PR #27.

### Infra externa (no en código)

- DNS de `qavante.com` registrado en GoDaddy, NS migrados a Cloudflare (2026-05-12).
- Worker `qavante-web` con custom domain `app.qavante.com` bindeado (Cloudflare dashboard, sincronizado en `wrangler.toml`).
- CNAME `api.qavante.com → tooxs-gestion-api.fly.dev` (DNS-only) en Cloudflare.
- CORS allowlist actualizado en `qavante-api` (PR #61 backend, commit `a0c8823`).
- Cert Fly Let's Encrypt para `api.qavante.com` — pendiente `fly certs create` manual.

---

## [0.5.0] — 2026-05-12

Sprint C0 — Milestone C parcial (auth FE).

### Added

- **API client tipado** contra FastAPI con interceptor 401 + refresh automático (`src/lib/api/client.ts`) — PR #12 (C0-10).
- **Pantalla de login** con react-hook-form + zod, validación RUT chilena, formateo CLP, manejo de errores con Anexo C.3 (`src/components/forms/login-form.tsx`) — PR #13 (C0-12).
- **Middleware Next.js** para protección de rutas: matcher sobre `/inicio`, `/caja`, `/cobrar`, `/pagar`, `/gestion`, `/administracion`. Sin cookie → 307 a `/login?redirect=<path>` — PR #14 (C0-13), corregido en PR #20 (movido a `src/middleware.ts` + e2e contra regresión).
- **Contrato cross-repo** documentado: `docs/backend-contracts/c0-auth-and-users.md` para coordinar con CC-API (C0-11 + C0-14) — PR #18.

### Changed

- Target de deploy alineado a **Cloudflare Workers** vía `@opennextjs/cloudflare` (no Pages) — PR #21 (cierra el loop iniciado en PRs #5/#7).

---

## [0.4.0] — 2026-05-11

Sprint C0 — Milestone B (Design System + Shell).

### Added

- **Tokens del Sistema de Diseño Qavante** (`src/styles/tokens.css`) — paleta, tipografía, spacing, sombras del Anexo B.2/B.4 del Documento Maestro — PR #8 (C0-06).
- **Componentes capa 1**: `QavanteButton`, `QavanteInput` (variants text/currency/date/rut con formateo), `QavanteBadge`, `QavanteCard`, `QavanteEmpty`, `QavanteSourceTag` — PR #9 (C0-07).
- **Layout shell global** con sidebar de 6 módulos + header + botón flotante Preguntar a Qavante (placeholder C0) — PR #10 (C0-08).
- **6 páginas placeholder** con pregunta central + `QavanteEmpty` (Inicio, Caja, Cobrar, Pagar, Gestión, Administración) — PR #11 (C0-09).

---

## [0.3.0] — 2026-05-10

Sprint C0 — Milestone A (Setup base).

### Added

- **Repo `qavante-web`** con Next.js 15 + React 19 + TypeScript strict + Tailwind 4 + shadcn/ui — PR #1 (C0-01/C0-02).
- **Wrangler.toml** + workflow `deploy-cloudflare.yml` para deploy a Cloudflare Workers desde main.
- **Prettier + Husky + lint-staged + .editorconfig** — PR #15 (C0-04).
- **CI con jobs paralelos**: lint, typecheck, test, build, e2e, secrets-scan (gitleaks) — PR #17 (C0-05).

### Fixed

- CI roja desde C0-02 por lock-file desincronizado, destrabada como puente a C0-05 — PR #16.

---

[Unreleased]: https://github.com/fperezd/qavante-web/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/fperezd/qavante-web/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/fperezd/qavante-web/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/fperezd/qavante-web/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fperezd/qavante-web/releases/tag/v0.3.0
