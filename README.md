# Qavante Web

Frontend de Qavante (Next.js 15 + React 19 + TypeScript + Tailwind 4 + shadcn/ui) desplegable en Cloudflare Pages.

**Estado**: ✅ C0-01 completado | 🚀 C0-02 en progreso (manual Cloudflare setup)

## Requisitos

- Node.js 22 LTS (ver `.nvmrc`)
- npm 10+
- (Cloudflare Pages): cuenta en Cloudflare + GitHub conectado

## Variables de entorno

Copiar `.env.example` y ajustar valores locales:

- `NEXT_PUBLIC_API_URL` (default: `https://tooxs-gestion-api.fly.dev`)
- `NEXT_PUBLIC_APP_ENV` (default: `development`)

## Comandos

- `npm run dev`: servidor local (http://localhost:3000)
- `npm run build`: build de Next.js
- `npm run lint`: linting (ESLint)
- `npm run typecheck`: chequeo de TypeScript strict
- `npm run test`: pruebas unitarias (Vitest)
- `npm run e2e`: pruebas e2e (Playwright)
- `npm run generate:api`: genera tipos desde OpenAPI backend (https://tooxs-gestion-api.fly.dev/openapi.json)
- `npm run build:cloudflare`: build para Cloudflare Pages con OpenNext

## Deployment a Cloudflare Pages

**Código listo**: `npm run build:cloudflare` valida exitosamente.

**Setup manual requerido**: Ver [C0-02-CLOUDFLARE-SETUP.md](./C0-02-CLOUDFLARE-SETUP.md) para:
1. Crear proyecto en Cloudflare Pages
2. Configurar environment variables
3. Registrar y apuntar dominio `qavante.cl`
4. Habilitar SSL y custom domain

**Después del setup manual**: GitHub Actions despliega automáticamente en cada push a `main`.

## Cloudflare Pages

- Config base en `wrangler.toml`
- Build command: `npx @cloudflare/next-on-pages@1.13.2`
- Output directory: `.vercel/output/static`
- Compat flags: `["nodejs_compat"]`
- Middleware: declarado en `middleware.ts` (Edge Runtime)

## Gobernanza

- Ownership: `.github/CODEOWNERS` (fernando-qavante)
- PR template: `.github/pull_request_template.md`
- CI/CD: `.github/workflows/ci.yml` (lint + test + build)
- Deploy: `.github/workflows/deploy-cloudflare.yml` (auto on push main)
- Branch protection: Documentado (require PR approval + CI green)

## Estructura del proyecto

Ver `QAVANTE_SPRINT_C0_KIT.md` sección 1.2 para estructura completa.
