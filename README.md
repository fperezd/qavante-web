# Qavante Web

Frontend de Qavante (Next.js 15 + React 19 + TypeScript + Tailwind 4 + shadcn/ui) desplegable en Cloudflare Pages.

## Requisitos

- Node.js 22 LTS (ver `.nvmrc`)
- npm 10+

## Variables de entorno

Copiar `.env.example` y ajustar valores locales:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_ENV`

## Comandos

- `npm run dev`: servidor local
- `npm run build`: build de Next.js
- `npm run lint`: linting
- `npm run typecheck`: chequeo de TypeScript
- `npm run test`: pruebas unitarias (Vitest)
- `npm run e2e`: pruebas e2e (Playwright)
- `npm run generate:api`: genera `src/lib/api/types.ts` desde OpenAPI backend
- `npm run build:cloudflare`: build para Cloudflare Pages con OpenNext

## Cloudflare Pages

- Config base en `wrangler.toml`
- Output directory: `.vercel/output/static`
- Compat flag: `nodejs_compat`

## Gobernanza

- Ownership en `.github/CODEOWNERS`
- Template de PR en `.github/pull_request_template.md`
- Workflows iniciales en `.github/workflows/`
