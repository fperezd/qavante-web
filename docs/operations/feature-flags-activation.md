# Activación de feature flags en producción

> Cómo activar/desactivar las features gateadas de `qavante-web` en producción.
> Mismo patrón vale para `localhost` (dev) — la diferencia es dónde se setea la env var.

## Modelo mental — ADR-0008 + ADR-0012

Hay 9 feature flags definidas en [`src/lib/feature-flags.ts`](../../src/lib/feature-flags.ts). Cada uno gobierna una sección del producto. **Todas tienen default `false` (la sección renderiza un estado "todavía no disponible" en lugar de UI mock).**

Activar un flag requiere setear una env var **explícita** en el entorno donde corre el FE. La env var sigue la convención `NEXT_PUBLIC_FF_<FLAG_SCREAMING_SNAKE>`.

Importante: `NEXT_PUBLIC_*` se **inlinea en build-time** por Next.js — no se lee del `[vars]` de wrangler.toml en runtime. Esto significa que cambiar el flag en prod **requiere redeploy** del Worker.

## Mapping flag → env var → endpoint que gobierna

| Flag (camelCase)             | Env var                                       | Endpoint backend que gobierna                |
| ---------------------------- | --------------------------------------------- | -------------------------------------------- |
| `managementAccounts`         | `NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS`          | `/api/management/accounts/tree`              |
| `managementDimensions`       | `NEXT_PUBLIC_FF_MANAGEMENT_DIMENSIONS`        | `/api/management/dimensions`                 |
| `industryTemplates`          | `NEXT_PUBLIC_FF_INDUSTRY_TEMPLATES`           | `/api/management/industry-templates`         |
| `multiCurrency`              | `NEXT_PUBLIC_FF_MULTI_CURRENCY`               | `/api/core/currencies`                       |
| `classificationRules`        | `NEXT_PUBLIC_FF_CLASSIFICATION_RULES`         | `/api/treasury/classification-rules`         |
| `bankMovementClassification` | `NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION` | `/api/bank-movements/{movement_id}/classify` |
| `phase2PlanningPreview`      | `NEXT_PUBLIC_FF_PHASE2_PLANNING_PREVIEW`      | `/api/management/financial-versions`         |
| `siiQueries`                 | `NEXT_PUBLIC_FF_SII_QUERIES`                  | `/api/sii/health`                            |
| `cashFlowReport`             | `NEXT_PUBLIC_FF_CASH_FLOW_REPORT`             | `/api/treasury/reports/cash-flow`            |

El mapping vive en `FLAG_GATING_ENDPOINT` en `src/lib/feature-flags.ts` — actualizar acá cuando se agregue un flag nuevo.

## Activar un flag en producción (Cloudflare Workers)

1. **Pre-requisito**: el endpoint backend que el flag gobierna debe estar deployado en `api.qavante.com`. Si no, activar el flag muestra UI rota (loading infinito, 404, etc.). Para verificar:

   ```
   curl -I https://api.qavante.com/api/<endpoint-de-la-tabla>
   ```

   Si responde 401 (sin sesión) o 200, el endpoint existe. Si responde 404, falta backend.

2. **Cloudflare Workers Dashboard**:
   1. https://dash.cloudflare.com → tu cuenta → **Workers & Pages** → **`qavante-web`**.
   2. Tab **Settings** → sección **Variables and secrets** → **Add variable**.
   3. Type: **Plain Text**. Name: `NEXT_PUBLIC_FF_<...>`. Value: `true` (o `false` para apagar).
   4. **Save and deploy**. Esto rebuildea el Worker con la env var como build-time constant.

3. **Validar**:
   - Refresh `https://app.qavante.com/<ruta-gateada>` en una ventana nueva (Ctrl+F5 para saltar caché CDN).
   - Si el flag está bien activado, la pantalla muestra el contenido real; si no, sigue mostrando `FeatureUnavailableState`.

## Desactivar (kill-switch)

Mismo procedimiento, valor `false`. Útil si una feature en prod tiene problemas y querés ocultarla rápido sin esperar al motor de `/api/management/config` (que aún no existe — ver ADR-0008).

También podés **borrar la variable** completamente: el código cae al default `false` igual.

## Activar en local (dev)

`.env.local` (gitignored):

```
NEXT_PUBLIC_FF_CASH_FLOW_REPORT=true
NEXT_PUBLIC_API_MOCKING=enabled
NEXT_PUBLIC_API_URL=http://localhost:3000
```

`npm run dev` lee `.env.local` directamente. Sin redeploy necesario (Next.js dev server reinicia el HMR).

Si activás un flag en dev pero el endpoint backend no existe en MSW (ver `src/test/msw/handlers.ts`), agregar handler primero o usar `NEXT_PUBLIC_API_MOCKING=disabled` para apuntar al backend real `https://api.qavante.com`.

## Activar en Playwright (E2E)

Pasar la env var en `webServer.env` de `playwright.config.ts` o en el step del workflow. Ejemplo (no implementado hoy, indicativo):

```ts
webServer: {
  command: "npm run dev",
  env: {
    NEXT_PUBLIC_FF_CASH_FLOW_REPORT: "true",
    NEXT_PUBLIC_API_MOCKING: "enabled",
  },
},
```

## Verificar qué flags están activos en prod

No hay endpoint dedicado para esto (todavía — eventualmente vendrá `/api/management/config`). Mientras tanto:

- **Cloudflare Dashboard**: Workers & Pages → `qavante-web` → Settings → Variables and secrets. Las que aparezcan listadas son las que están seteadas.
- **Manual desde el browser**: abrí `view-source:https://app.qavante.com/<ruta-gateada>`. Si ves la pantalla real → flag ON. Si ves "todavía no disponible" → flag OFF.

## Errores comunes

| Síntoma                                        | Causa probable                                                            | Fix                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Variable seteada pero pantalla no cambia       | No hiciste redeploy del Worker (env var inlineada en build-time)          | Click "Save **and deploy**" en CF Dashboard.               |
| Pantalla cargando infinito tras activar        | Endpoint backend no deployado todavía                                     | Verificar con `curl` y/o desactivar el flag.               |
| Variable con valor `True` o `TRUE` no funciona | Parser case-insensitive solo acepta `true`/`false` exactos                | Usar minúsculas. Ver `readOverride` en `feature-flags.ts`. |
| Variable con valor `yes` o `1` no funciona     | Mismo motivo                                                              | Usar `true`/`false`.                                       |
| Pantalla muestra UI mock o datos raros         | Tenés `NEXT_PUBLIC_API_MOCKING=enabled` activo en prod (no debería pasar) | Borrar la variable de mocking en CF Dashboard.             |

## Cuando agregar un flag nuevo

Si construyes una pantalla nueva que depende de un endpoint backend que recién va a deployarse o que es opcional:

1. Agregá la string al array `FEATURE_FLAGS` en `src/lib/feature-flags.ts`.
2. Agregá una entry en `FLAG_GATING_ENDPOINT` con el path del endpoint.
3. Actualizá el test count (`los N flags`) en `feature-flags.test.ts`.
4. Gateá la pantalla con `resolveFeatureFlags().myNewFlag ? <RealView /> : <FeatureUnavailableState />`.
5. Agregá una fila a la tabla de mapping arriba en este runbook.

NO actives el flag por default. Default OFF es seguro (ADR-0008).

## Referencias

- [ADR-0008 — feature flags gating pantallas sin backend](../adr/0008-feature-flags-gating-pantallas-sin-backend.md).
- [ADR-0012 — override flags en prod via Cloudflare env vars](../adr/0012-flags-prod-override-env-vars.md).
- `src/lib/feature-flags.ts` — implementación.
- `src/lib/feature-flags.test.ts` — invariantes.
