# Activación de feature flags en producción

La ruta de promoción es [Deploy web to Azure PROD](../../.github/workflows/deploy-azure-prod.yml).
Los flags de producción se fijan en el `Dockerfile` de la imagen que el workflow
construye; no se cambian desde paneles de proveedor ni secretos de GitHub.
Con Actions habilitado, un merge que cambie `Dockerfile` en `main` despliega
automáticamente a producción.

## Invariante

Todas las flags de `src/lib/feature-flags.ts` son `false` por defecto. Activar
una requiere una modificación revisada de la imagen y un despliegue validado.
El frontend nunca inventa una respuesta: si falta el
endpoint, la pantalla debe mantener su estado no disponible.

## Procedimiento

1. Verificar que el endpoint backend requerido existe en `api.qavante.com`.
2. Cambiar únicamente el valor `NEXT_PUBLIC_FF_<FLAG>` correspondiente en las
   secciones `ENV` de build y runner del `Dockerfile`.
3. Abrir PR, completar los checks y mergear a `main` durante la ventana de
   despliegue con Actions habilitado.
4. Verificar la ejecución de [Deploy web to Azure PROD](./deploy-runbook.md).
   Si el push ocurrió con Actions apagado, iniciar el workflow manualmente.
5. Validar la ruta en una sesión nueva. Si el endpoint está ausente, dejar la
   flag apagada y corregir primero el contrato backend.

Para un kill-switch, revertir sólo ese valor a `false` en el `Dockerfile` y
repetir el mismo despliegue Azure. No se modifica infraestructura ni
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

- [Despliegue Azure PROD](./deploy-runbook.md).
- [ADR-0008 — feature flags](../adr/0008-feature-flags-gating-pantallas-sin-backend.md).
- `src/lib/feature-flags.ts` y `src/lib/feature-flags.test.ts`.
