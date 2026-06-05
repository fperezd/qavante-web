# Activar pantallas de tesorería C3 en prod (post-ADR-0027) — handoff para Fernando

> ### ✅ Resultado de la activación — 4/4 OK (al 2026-05-31)
>
> **Las 4 pantallas de tesorería C3 están LIVE en prod:** `/caja/proyeccion`,
> `/caja/por-clasificar`+`/clasificados`, `/administracion/reglas-clasificacion`
> y `/administracion/estructura-gestion`.
>
> Las primeras 3 se activaron el 2026-05-30. La 4ta (`managementAccounts`) quedó
> OFF unos días porque `GET /api/management/accounts/tree` tiraba **500** en el
> path autenticado (los 500 además salían sin CORS → el FE lo veía como error de
> red). **Bug de backend, FE siempre OK.** CC-API lo arregló y verificó end-to-end;
> el flag se reactivó en `wrangler.toml` el 2026-05-31. Histórico del incidente:
> [`../backend-contracts/management-accounts-tree-500-2026-05-30.md`](../backend-contracts/management-accounts-tree-500-2026-05-30.md).

> **TL;DR.** El backend (CC-API-A, ADR-0027, 2026-05-30) hizo que **5 grupos de
> endpoints de tesorería C3 acepten la cookie de sesión** del FE (antes eran
> api-key-only → 401 `Falta X-Api-Key`, la Brecha 0). **4 pantallas del FE ya
> cableadas quedan listas para activar via flag.** Esto cierra el bloqueante
> que tenía a esas pantallas en `FeatureUnavailableState` en prod.
>
> Preparado autónomamente por CC-WEB el 2026-05-30 (Fernando ausente 3h). Las
> acciones de abajo las ejecutas tú (acceso Cloudflare + redeploy).

## Qué ya hizo CC-WEB (mergeado)

- **PR #233** — `generate:api` contra prod: `types.ts` sincronizado con el
  OpenAPI republicado (#181 backend). Diff 100% aditivo (param `cookie`), `tsc`
  verde → las vistas son contract-compatible. **No hay cambio de código de FE
  necesario**; las pantallas ya estaban cableadas, solo gateadas por flag OFF.
- Verificación en prod por `curl`: los 5 grupos devuelven `{"code":"no_session"}`
  (auth por cookie activa), ya no `Falta X-Api-Key`.

## Pantallas activables AHORA (endpoint cookie-auth ✅ + vista cableada ✅)

| Pantalla                                      | Flag (env var)                                | Endpoint que consume                                  |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| `/caja/proyeccion`                            | `NEXT_PUBLIC_FF_CASH_FLOW_REPORT`             | `GET /api/treasury/reports/cash-flow`                 |
| `/caja/por-clasificar` + `/caja/clasificados` | `NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION` | `GET /api/bank-movements` (+ classify / suggest-rule) |
| `/administracion/reglas-clasificacion`        | `NEXT_PUBLIC_FF_CLASSIFICATION_RULES`         | `GET\|POST\|PATCH /api/treasury/classification-rules` |
| `/administracion/estructura-gestion`          | `NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS`          | `GET /api/management/accounts/tree` (+ CRUD)          |

## Pasos (Cloudflare, ~1 var por pantalla + 1 redeploy)

Mismo procedimiento que [`feature-flags-activation.md`](./feature-flags-activation.md):

1. dash.cloudflare.com → **Workers & Pages** → **`qavante-web`** → **Settings** → **Variables and secrets**.
2. **Add variable** (Plain Text) por cada flag de arriba que quieras activar. Value `true` (exacto, minúsculas).
3. **Save and deploy** (un solo redeploy cubre todas las vars que agregues).
4. Validar cada ruta con Ctrl+F5 (saltar caché CDN):
   - Si muestra datos reales → flag ON + endpoint respondiendo con tu cookie. ✅
   - Si muestra `FeatureUnavailableState` → flag mal seteado.
   - Si carga infinito / error → revisar (ver más abajo).

**Sugerencia de orden:** activá **`cashFlowReport`** primero (la más simple,
read-only). Si esa anda, las otras 3 siguen el mismo patrón de auth.

## Smoke E2E que CC-API-A pidió

CC-API-A dejó el backend "listo y esperando, adelantado al FE" y quiere el
**smoke E2E real**: con una pantalla activada y tu sesión, el FE pega al
endpoint con la cookie. Si ves datos → smoke verde end-to-end (cierra el loop
que el curl directo no puede, porque curl no tiene cookie de sesión válida).

## ⚠️ NO activar todavía (endpoint sigue api-key-only)

Estos siguen devolviendo `Falta X-Api-Key` — ADR-0027 **no** los cubrió:

| Flag                                   | Endpoint aún bloqueado           |
| -------------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_FF_MANAGEMENT_DIMENSIONS` | `GET /api/management/dimensions` |
| `NEXT_PUBLIC_FF_MULTI_CURRENCY`        | `GET /api/core/currencies`       |
| `NEXT_PUBLIC_FF_SII_QUERIES`           | `GET /api/sii/*`                 |

Activarlos mostraría la pantalla cargando infinito / error. **Handoff residual
para CC-API-A:** extender ADR-0027 (cookie auth) a los dominios `management/
dimensions`, `core/currencies` y `sii/*` para desbloquear el resto (Sprint
C1 SII, multimoneda, vistas-gestión).

## Kill-switch

Si una pantalla activada da problemas en prod: misma var con valor `false` (o
borrarla) + redeploy → vuelve a `FeatureUnavailableState`. Sin riesgo.
