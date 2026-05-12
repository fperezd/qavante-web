# ADR-0001: Cloudflare Workers vía `@opennextjs/cloudflare` (no Pages)

- **Status:** Accepted
- **Fecha:** 2026-05-08
- **Decididores:** Fernando + CC-WEB
- **Tickets / PRs:** #5, #7, #21

## Contexto

Sprint C0 requiere desplegar Next.js 15 (App Router + React 19 server components + middleware) en Cloudflare. Hay dos opciones oficiales:

1. **Cloudflare Pages con `next-on-pages`** — el camino "tradicional" desde 2023.
2. **Cloudflare Workers con `@opennextjs/cloudflare`** — el path recomendado por Cloudflare desde 2024 para nuevos proyectos Next.js.

Cloudflare migró su recomendación oficial: nuevos proyectos van a Workers; Pages queda para sitios estáticos puros.

## Decisión

**Usamos Cloudflare Workers vía adapter `@opennextjs/cloudflare`.** El bundle de Next.js se empaqueta a `workerd` con `compatibility_flags = ["nodejs_compat"]`. El entrypoint es `.open-next/worker.js` y los assets estáticos van bajo `.open-next/assets/` con `[assets]` binding en `wrangler.toml`.

Restricción derivada: **prohibido `export const runtime = 'edge'`** en pages, routes y middleware. El adapter empaqueta para `workerd` con `nodejs_compat`, no para Next Edge Runtime. Declarar `runtime = 'edge'` rompe el build. Esta regla está en CLAUDE.md regla 4.

## Alternativas consideradas

- **Cloudflare Pages con `next-on-pages` — descartada:**
  Exige `runtime = 'edge'` declarado en cada page/route/middleware, lo cual:
  - Limita las librerías usables (muchas dependen de APIs Node).
  - Genera fricción constante: el dev olvida la directiva, el build falla.
  - Cloudflare ya no la recomienda para nuevos proyectos.

- **Vercel — fuera de scope:**
  Aunque es el deploy "nativo" de Next.js, el stack de Tooxs está estandarizado en Cloudflare (backend en Fly, frontend en Workers, R2 para storage, KV para caché). Mantener un solo proveedor de edge simplifica DNS, observabilidad y billing.

## Consecuencias

### Positivas

- Compat con la mayoría del ecosistema Node (lo que está bajo `nodejs_compat` de workerd).
- Recomendación oficial actualizada — futura mantenibilidad asegurada.
- Workers tiene mejor model para custom domains y bindings (R2, KV, Durable Objects) si en Fase 2 los necesitamos.

### Negativas / tradeoffs aceptados

- El bundle es más pesado que un Pages estático puro (~5MB gzip vs <1MB).
- `nodejs_compat` cubre la mayoría pero no todo Node — listado oficial: [developers.cloudflare.com/workers/runtime-apis/nodejs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/). Si una librería usa `child_process`, `fs` nativo, etc., hay que buscar alternativa o moverla al backend.
- Cualquier dev que venga de Next + Vercel tiene que aprender la diferencia: `wrangler deploy` no es `vercel deploy`.

### Acciones que destraba o requiere

- [x] `wrangler.toml` con `compatibility_flags = ["nodejs_compat"]` y entrypoint `.open-next/worker.js`.
- [x] CLAUDE.md regla 4 documenta la prohibición de `runtime = 'edge'`.
- [x] Workflow `.github/workflows/deploy-cloudflare.yml` corre `npm run build:cloudflare` + `wrangler deploy`.
- [x] [docs/operations/cloudflare-workers-setup.md](../operations/cloudflare-workers-setup.md) tiene el runbook.

## Referencias

- [@opennextjs/cloudflare get-started](https://opennext.js.org/cloudflare/get-started) — fuente de la decisión.
- PR #5 — alineación de CLAUDE.md regla 4.
- PR #7 — bump del Documento Maestro a v2.6.3 con stack Workers.
- PR #21 — alineación de todo el repo a Workers (no Pages).
- [docs/operations/cloudflare-workers-setup.md](../operations/cloudflare-workers-setup.md) — runbook operativo.
- [docs/archive/c0-02-cloudflare-pages-attempt-deprecated.md](../archive/c0-02-cloudflare-pages-attempt-deprecated.md) — intento descartado conservado por trazabilidad.
