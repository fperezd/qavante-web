# Registro histórico: activación de pantallas de tesorería C3 (2026-05-30)

> **Nota operacional 2026-09-07:** este documento conserva el resultado
> histórico de la activación. No contiene pasos operativos vigentes. Toda
> activación futura sigue el [despliegue Azure PROD](./deploy-runbook.md)
> y el procedimiento de [feature flags](./feature-flags-activation.md).

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
> el flag se reactivó en la configuración de build vigente entonces. Histórico del incidente:
> [`../backend-contracts/management-accounts-tree-500-2026-05-30.md`](../backend-contracts/management-accounts-tree-500-2026-05-30.md).

> **TL;DR.** El backend (CC-API-A, ADR-0027, 2026-05-30) hizo que **5 grupos de
> endpoints de tesorería C3 acepten la cookie de sesión** del FE (antes eran
> api-key-only → 401 `Falta X-Api-Key`, la Brecha 0). **4 pantallas del FE ya
> cableadas quedan listas para activar via flag.** Esto cierra el bloqueante
> que tenía a esas pantallas en `FeatureUnavailableState` en prod.
>
> Preparado autónomamente por CC-WEB el 2026-05-30 (Fernando ausente 3h). Las
> acciones de abajo corresponden a esa fecha y no deben repetirse como runbook.

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

## Estado del registro

El procedimiento original queda sólo como contexto. Para un cambio futuro,
usar el documento actual de feature flags y el despliegue Azure; no inferir una
vía de promoción desde este registro.

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

El estado histórico no habilita rollback ni cambios actuales. Para un
kill-switch o rollback, seguir el runbook de despliegue Azure vigente.
