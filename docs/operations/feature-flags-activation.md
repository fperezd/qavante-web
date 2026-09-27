# Activación de feature flags en producción

La única ruta de promoción es el [release local verificable](./local-release.md).
Los flags de producción se fijan en el `Dockerfile` de la imagen que esa ruta
construye; no se cambian desde paneles de proveedor, workflows ni secretos de
GitHub. Un merge por sí solo no cambia producción.

## Invariante

Todas las flags de `src/lib/feature-flags.ts` son `false` por defecto. Activar
una requiere una modificación revisada de la imagen y una promoción local
verificada por digest. El frontend nunca inventa una respuesta: si falta el
endpoint, la pantalla debe mantener su estado no disponible.

## Procedimiento

1. Verificar que el endpoint backend requerido existe en `api.qavante.com`.
2. Cambiar únicamente el valor `NEXT_PUBLIC_FF_<FLAG>` correspondiente en las
   secciones `ENV` de build y runner del `Dockerfile`.
3. Abrir PR, completar los gates locales y mergear a `main`.
4. Ejecutar el [release local](./local-release.md) sobre el tip limpio de
   `origin/main`.
5. Validar la ruta en una sesión nueva. Si el endpoint está ausente, dejar la
   flag apagada y corregir primero el contrato backend.

Para un kill-switch, revertir sólo ese valor a `false` en el `Dockerfile` y
repetir el mismo release local verificable. No se modifica infraestructura ni
se usa un bypass de configuración.

## Mapping flag → endpoint

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
| `inicioMvp`                  | `NEXT_PUBLIC_FF_INICIO_MVP`                   | `/api/me`                                    |
| `miCuenta`                   | `NEXT_PUBLIC_FF_MI_CUENTA`                    | POST `/api/auth/logout` (+ lee `/api/me`)    |
| `financialDecisionHome`      | `NEXT_PUBLIC_FF_FINANCIAL_DECISION_HOME`      | `/api/treasury/financial-position`           |

El mapping vive en `FLAG_GATING_ENDPOINT` en `src/lib/feature-flags.ts`.

## Desarrollo y pruebas

En desarrollo, `.env.local` sigue siendo local y no se versiona:

```text
NEXT_PUBLIC_FF_CASH_FLOW_REPORT=true
NEXT_PUBLIC_API_MOCKING=enabled
NEXT_PUBLIC_API_URL=http://localhost:3000
```

En Playwright, pasar la variable por `webServer.env`. Agregar una flag exige
actualizar `FEATURE_FLAGS`, `FLAG_GATING_ENDPOINT`, su prueba de invariantes y
la tabla de este documento.

## Referencias

- [Release local verificable](./local-release.md).
- [ADR-0008 — feature flags](../adr/0008-feature-flags-gating-pantallas-sin-backend.md).
- `src/lib/feature-flags.ts` y `src/lib/feature-flags.test.ts`.
