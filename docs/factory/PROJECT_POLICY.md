# PROJECT_POLICY.md — Qavante Web

Overlay de proyecto sobre TOOXS AI Factory Standard v1.0.
Puede endurecer el estándar corporativo, pero no debilitarlo sin excepción/ADR explícita.

## Stack

- Next.js 16 + React 19 + TypeScript.
- Tailwind 4 + shadcn/ui.
- Cloudflare Workers mediante `@opennextjs/cloudflare`.
- Backend/contrato: `tooxs-digital/qavante-api` vía OpenAPI; no acoplamiento por memoria de agentes.

## Reglas frontend no negociables

- No editar `src/lib/api/types.ts` manualmente; regenerar desde OpenAPI.
- No duplicar en frontend cálculos de Pulso, forecast, P&L u otra lógica financiera canónica del backend.
- El frontend no llama LLMs directamente; toda capacidad LLM pasa por la frontera/backend aprobada del producto (hoy `/api/assistant/chat` mientras ese contrato siga vigente).
- No exponer secretos ni tokens en storage cliente. Tokens de autenticación no van a `localStorage`, `sessionStorage` ni `IndexedDB`; usar los mecanismos httpOnly/cookies vigentes del proyecto.
- No introducir Node-only APIs incompatibles con el runtime desplegado.
- No declarar `export const runtime = 'edge'` donde el adapter actual requiere el runtime por defecto.
- No usar `any` sin justificación explícita.
- Datos faltantes/partial/stale/error se muestran honestamente; nunca como cero o éxito implícito.
- INV-FX-001 aplica también al frontend: no sumar monedas distintas ni rotular una mezcla como CLP.
- No force-push a `main` ni a ramas compartidas/protegidas.
- R0/R1/R2 reversibles siguen el camino autónomo cuando los checks requeridos de GitHub Actions están verdes. Producción conserva SHA/árbol/digest, smoke, observación y rollback sin checkpoint humano.
- Un PR debe cerrar o referenciar una unidad de trabajo explícita y mantener un propósito único.

## Cross-repo

Un cambio de contrato se coordina mediante OpenAPI + Issue/PR. El frontend no depende de transcripts o handoffs informales como contrato.

Si falta un endpoint/capacidad backend, se abre/actualiza el Issue correspondiente en `qavante-api`; no se inventa el contrato en frontend.

## Riesgo

R2 si cambia semántica financiera visible, auth/credenciales, contrato material, moneda, decisiones financieras mostradas o acciones irreversibles.
R1 para feature/bug/UI normal. R0 para docs/tests/tooling/refactor sin comportamiento.

## Validación

La suite y umbrales vigentes se definen por los scripts/configuración real del repo. Docker local puede ejecutar lint, typecheck, contrato, coverage, Storybook, build + size budget, E2E, Lighthouse, auditoría y gitleaks como feedback; los checks requeridos se publican mediante GitHub Actions. Los estados `local-*` están retirados.

El implementador corre validación focalizada; Docker local ejecuta la validación completa requerida.

## Deploy y verificación

Cloudflare build/deploy debe ser gate real. Un cambio no se declara DONE si el required deployment/production verification aplicable está fallando o es desconocido.

Un fallo de preview/deploy aplicable se diagnostica antes de mergear; los cambios sin superficie desplegable no inventan un deploy.
