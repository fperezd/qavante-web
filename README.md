# Qavante Web

Frontend de Qavante (Next.js 15 + React 19 + TypeScript strict + Tailwind 4 + shadcn/ui), desplegable en **Cloudflare Workers** vía adapter `@opennextjs/cloudflare`.

**Estado de sprints (al 2026-05-28, ver [último audit K.4](./docs/audits/c3-mvp-cycle-2026-05-27-28.md)):**

- ✅ **Sprint C0** — Auth, users, admin mínima, shell. Login en prod funcional end-to-end (cookie shared-parent `.qavante.com` desde [ADR-0003](./docs/adr/0003-api-qavante-com-shared-parent.md)).
- ✅ **Sprint C1** — SII end-to-end (F29 + Libros de Compras/Ventas + BHE).
- ✅ **Sprint C2** — Data layer de management mutations (accounts + dimensions + values + assignments). UI editor parcial.
- 🟡 **Sprint C3** — **MVP cableado** ([PR #196](https://github.com/fperezd/qavante-web/pull/196)): `/caja/proyeccion` con reporte agregado del backend. Gated por flag `cashFlowReport` (default OFF; activar con [runbook](./docs/operations/feature-flags-activation.md)). Brechas restantes (caja mínima, acciones recomendadas, etc.) documentadas en [c3-treasury-reports-gaps.md](./docs/backend-contracts/c3-treasury-reports-gaps.md) — esperan deploy de CC-API.
- ⏳ **Sprint C4** — Cobranza/pagos priorizados — pendiente.
- ⏳ **Sprint C5+** — Gestión avanzada, drivers, IA financiera — pendientes.

Patrón de ejecución de cada sprint definido en [ADR-0013 (MVP honesto, no inventar lógica financiera en FE)](./docs/adr/0013-treasury-reports-mvp-honest-no-invention.md).

Ver audits previos: [Sprint C1 + C2](./docs/audits/sprint-c1-end-to-end-cycle.md) · [Stretch UX 2026-05-24/25](./docs/audits/stretch-2026-05-24-25-ux-polish-stories.md) · [Milestone D](./docs/audits/c0-milestone-d-review.md) · [Milestone A-B-C](./docs/audits/c0-milestone-abc-review.md).

## Requisitos

- **Node.js 24** (ver [.nvmrc](./.nvmrc))
- npm 11+ (viene bundleado con Node 24)
- Cuenta en Cloudflare + permisos para crear Workers (sólo para deploy real, no para dev)

## Setup local

```bash
cp .env.example .env.local      # crear primero (no commiteado)
npm install
npm run dev                     # http://localhost:3000
```

Variables en `.env.local`:

- `NEXT_PUBLIC_API_URL` (prod canónica: `https://api.qavante.com` — ver [ADR-0003](./docs/adr/0003-api-qavante-com-shared-parent.md))
- `NEXT_PUBLIC_APP_ENV` (default: `development`)
- `NEXT_PUBLIC_API_MOCKING=enabled` (opcional: activa [MSW](./docs/adr/0005-mock-service-worker-for-fe-dev.md) para desarrollar sin backend)
- `NEXT_PUBLIC_FF_<FLAG>` (opcional: activa una feature gateada — ver [runbook de feature flags](./docs/operations/feature-flags-activation.md))

Sin `.env.local`, el API client lanza `ApiError("NEXT_PUBLIC_API_URL no configurada")` cuando se invoca cualquier request al backend.

## Comandos

| Comando                           | Qué hace                                                                |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                     | Servidor local de Next.js con HMR                                       |
| `npm run build`                   | Build de producción de Next.js                                          |
| `npm run start`                   | Servidor de producción (requiere `build` previo)                        |
| `npm run lint`                    | ESLint sobre todo el repo                                               |
| `npm run typecheck`               | `tsc --noEmit` con strict mode                                          |
| `npm run test`                    | Vitest unit tests (pasa con `--passWithNoTests` mientras no haya specs) |
| `npm run e2e`                     | Playwright tests (levanta server prod automáticamente vía `webServer`)  |
| `npm run generate:api`            | Regenera `src/lib/api/types.ts` desde `<API>/openapi.json`              |
| `npm run build:cloudflare`        | Empaqueta el bundle del Worker (`opennextjs-cloudflare build`)          |
| `npm run format` / `format:check` | Prettier                                                                |

## Stack y deploy

Target: **Cloudflare Workers** vía adapter `@opennextjs/cloudflare`. El build (`build:cloudflare`) produce `.open-next/worker.js` + `.open-next/assets/`. Wrangler hace el upload al Worker `qavante-web`.

- Config: [wrangler.toml](./wrangler.toml) (entrypoint, compatibility flags `nodejs_compat`, assets binding).
- Workflow deploy: [.github/workflows/deploy-cloudflare.yml](./.github/workflows/deploy-cloudflare.yml) — corre en cada push a `main` con `cloudflare/wrangler-action@v3`.
- Setup operativo (primera vez): [docs/operations/cloudflare-workers-setup.md](./docs/operations/cloudflare-workers-setup.md).
- Activar feature flags en prod: [docs/operations/feature-flags-activation.md](./docs/operations/feature-flags-activation.md).

**Restricciones de runtime (por nodejs_compat):**

- NO declarar `export const runtime = "edge"` en pages/routes/middleware.
- NO usar Node-only APIs no soportadas (`child_process`, etc.). Listado oficial: https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Gobernanza

- Ownership: [.github/CODEOWNERS](./.github/CODEOWNERS)
- PR template: [.github/pull_request_template.md](./.github/pull_request_template.md)
- CI (lint, typecheck, test, build, e2e, secrets-scan): [.github/workflows/ci.yml](./.github/workflows/ci.yml)
- Branch strategy: feat/\* → main (squash, sin develop) — ver Kit Sprint C0 línea 12.

## Documentación

- [QAVANTE_SPRINT_C0_KIT.md](./QAVANTE_SPRINT_C0_KIT.md) — tickets atómicos C0-01 a C0-18 con DoD.
- [CLAUDE.md](./CLAUDE.md) — prompt operativo de CC-WEB + reglas duras del proyecto.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — convenciones de branches, commits, PRs, DoD para contribuir.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — diagrama y descripción de alto nivel del sistema.
- `qavante_fase1_v2.6.4.docx` — Documento Maestro (read-only desde este repo). `qavante_fase1_v2.6.3.docx` queda como histórico.
- [docs/operations/](./docs/operations/) — runbooks operativos (Cloudflare Workers setup, [DNS de qavante.com](./docs/operations/cloudflare-dns.md), [GitHub secrets](./docs/operations/github-secrets.md)).
- [docs/backend-contracts/](./docs/backend-contracts/) — contratos HTTP esperados del backend para coordinación cross-repo con `qavante-api`.
- [docs/adr/](./docs/adr/) — Architecture Decision Records (decisiones arquitecturales con fecha y rationale).
- [docs/audits/](./docs/audits/) — reportes de revisión integral.
- [docs/archive/](./docs/archive/) — documentación deprecada conservada por trazabilidad.
- [CHANGELOG.md](./CHANGELOG.md) — historial de cambios por release (Keep a Changelog + versionado semántico pre-v1.0).
