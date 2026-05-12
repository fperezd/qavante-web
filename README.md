# Qavante Web

Frontend de Qavante (Next.js 15 + React 19 + TypeScript strict + Tailwind 4 + shadcn/ui), desplegable en **Cloudflare Workers** vía adapter `@opennextjs/cloudflare`.

**Estado Sprint C0:**

- ✅ Milestone A — Setup base (C0-01 a C0-05)
- ✅ Milestone B — Sistema de diseño y shell (C0-06 a C0-09)
- 🟡 Milestone C — Auth y conexión backend (C0-10/12/13 mergeados; C0-11/14 bloqueados en repo backend, contrato en [docs/backend-contracts/c0-auth-and-users.md](./docs/backend-contracts/c0-auth-and-users.md))
- ⏳ Milestone D — Admin mínima + cierre (pendiente)

Ver [docs/audits/c0-milestone-abc-review.md](./docs/audits/c0-milestone-abc-review.md) para la revisión integral del Anexo K.4.

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

- `NEXT_PUBLIC_API_URL` (default: `https://tooxs-gestion-api.fly.dev`)
- `NEXT_PUBLIC_APP_ENV` (default: `development`)

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
- `qavante_fase1_v2.6.3.docx` — Documento Maestro (read-only desde este repo).
- [docs/operations/](./docs/operations/) — runbooks operativos (Cloudflare Workers setup, [DNS de qavante.com](./docs/operations/cloudflare-dns.md), [GitHub secrets](./docs/operations/github-secrets.md)).
- [docs/backend-contracts/](./docs/backend-contracts/) — contratos HTTP esperados del backend para coordinación cross-repo con `qavante-api`.
- [docs/audits/](./docs/audits/) — reportes de revisión integral.
- [docs/archive/](./docs/archive/) — documentación deprecada conservada por trazabilidad.
