# PROJECT_POLICY.md — Qavante Web

Overlay de proyecto sobre TOOXS AI Factory Standard v1.0.
Puede endurecer el estándar corporativo, pero no debilitarlo sin excepción/ADR explícita.

## Stack

- Next.js 15 + React 19 + TypeScript.
- Tailwind 4 + shadcn/ui.
- Cloudflare Workers mediante `@opennextjs/cloudflare`.
- Backend/contrato: `fperezd/qavante-api` vía OpenAPI; no acoplamiento por memoria de agentes.

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
- Un agente no mergea cambios sin el gate humano requerido por la Factory/política del repo.
- Un PR debe cerrar o referenciar una unidad de trabajo explícita y mantener un propósito único.

## Cross-repo

Un cambio de contrato se coordina mediante OpenAPI + Issue/PR. El frontend no depende de transcripts o handoffs informales como contrato.

Si falta un endpoint/capacidad backend, se abre/actualiza el Issue correspondiente en `qavante-api`; no se inventa el contrato en frontend.

## Riesgo

R2 si cambia semántica financiera visible, auth/credenciales, contrato material, moneda, decisiones financieras mostradas o acciones irreversibles.
R1 para feature/bug/UI normal. R0 para docs/tests/tooling/refactor sin comportamiento.

## Validación

La suite y umbrales vigentes se definen por los workflows/configuración real del repo. Actualmente CI incluye lint, typecheck, coverage tests, Storybook tests, build + size budget, E2E, Lighthouse y gitleaks; esos controles no se sustituyen por prosa del agente.

El implementador corre validación focalizada; CI ejecuta la validación completa requerida.

## Deploy y verificación

Cloudflare build/deploy debe ser gate real. Un cambio no se declara DONE si el required deployment/production verification aplicable está fallando o es desconocido.

Un fallo de preview/deploy se diagnostica antes de mergear; nunca se ignora por tratarse de un cambio docs-only.
