<!-- Generado fielmente desde Qavante_Addendum_Frontend_Arquitectura_Taxonomia_Gestion.docx
     por CC-WEB el 2026-05-15. Fuente original .docx eliminada del repo (binario no versionable).
     Si el .docx original cambia, regenerar este archivo — NO editar a mano divergiendo del original. -->

# Addendum Frontend v2.0 — Qavante

> **⚠️ LEER ANTES DE EJECUTAR — Nota del CTO (CC-WEB, 2026-05-15)**
>
> Este documento es la transcripción **fiel** del addendum entregado por Fernando.
> Es una excelente especificación de producto/UX, pero **contiene supuestos de
> estado y 4 contradicciones con reglas duras del repo** que NO deben seguirse
> literalmente. Antes de ejecutar cualquier PR derivado de este addendum:
>
> 1. Leer **[`reconciliation.md`](./reconciliation.md)** — resuelve las 4
>    contradicciones P1 (Edge Runtime, Cloudflare Pages/Workers, `src/features/`,
>    naming de endpoints). En cada conflicto **gana el repo real / CLAUDE.md**,
>    según la propia regla de prioridad §4 y stop conditions §30 de este addendum.
> 2. Verificar el supuesto P0: la Tabla 2 afirma "Backend C1 100% / C2
>    implementado". **Falso al 2026-05-15**: el OpenAPI de producción NO expone
>    ninguno de los endpoints que este addendum requiere. PR #83 está bloqueado
>    hasta que el handoff backend ocurra de verdad (ver runbook
>    [`../backend-contracts/c1-sii-handoff-runbook.md`](../backend-contracts/c1-sii-handoff-runbook.md)).
> 3. Las decisiones arquitecturales que este addendum asume están formalizadas
>    como ADRs en [`../adr/`](../adr/) — esos ADRs ganan sobre la prosa de acá.
>
> Fuente de verdad operativa: **CLAUDE.md** > **ADRs** > este addendum
> (consistente con la jerarquía declarada en §4 del propio documento).

---

QAVANTE

Addendum Frontend Fase 1 / Preparación Fase 2

Integración post-handoff backend, taxonomía de gestión, clasificación, multimoneda y arquitectura UX escalable

Versión: Frontend Addendum v2.0 - especificación ejecutable para Claude Code

Repositorio objetivo: qavante-web

Estado base: C1-prep terminado en FE; esperando handoff backend para destrabar C1 real

Próximo PR: #83 - Integración FE post-handoff backend (Paso 6 del runbook)

Documento base: Qavante Documento Maestro v2.6.4 + Kit Sprint C0

Fecha: Mayo 2026

## Control del documento

| Campo                     | Definición                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre                    | Qavante - Addendum Frontend Fase 1 / Preparación Fase 2                                                                                        |
| Versión                   | v2.0 - documento corregido como especificación ejecutable para Claude Code                                                                     |
| Alcance                   | Frontend qavante-web: integración post-handoff backend, experiencia de taxonomía, clasificación, multimoneda y preparación Fase 2.             |
| Estado FE                 | C1-prep terminado; esperando handoff backend para iniciar C1 real.                                                                             |
| Próximo PR                | PR #83 - integración frontend post-handoff backend, Paso 6 del runbook.                                                                        |
| Stack                     | Next.js 15, App Router, TypeScript strict, Tailwind/shadcn, TanStack Query, RHF/Zod, TanStack Table, Recharts, Cloudflare Pages, Edge Runtime. |
| Regla de fuente de verdad | OpenAPI generado desde backend es el contrato técnico. Documento Maestro v2.6.4 manda sobre documentos auxiliares.                             |
| Audiencia                 | Claude Code frontend, desarrollador FE, reviewer técnico, CTO Qavante.                                                                         |

## 0. Instrucción principal para Claude Code

Este documento no es una idea, no es una referencia general y no es un prompt creativo. Es una especificación funcional, técnica y arquitectónica para implementar el frontend de Qavante de manera incremental sobre lo ya construido.

Restricción obligatoria: No debes iniciar código sin ejecutar primero el checklist de preflight de esta especificación.

Revisar el estado real del repo qavante-web antes de tocar archivos.

Confirmar rama base, PR pendiente y estado del C1-prep.

Verificar que el handoff backend esté disponible: OpenAPI, endpoints, enums, ejemplos de respuesta y changelog backend.

Ejecutar npm install si corresponde, npm run lint, npm run typecheck, npm run test y npm run build para establecer baseline.

Ejecutar npm run generate:api solo contra el OpenAPI backend vigente.

No editar manualmente src/lib/api/types.ts ni ningún archivo generado.

No inventar tipos, endpoints, rutas ni shapes si el backend no los expone.

No modificar la navegación principal de seis módulos salvo que esta especificación lo indique expresamente.

No crear pantallas técnicas visibles para usuarios de negocio.

Dividir el trabajo en PRs pequeños. El PR #83 debe ser integración post-handoff, no reconstrucción completa del frontend.

## 1. Contexto funcional de Qavante

Qavante es una plataforma SaaS de gestión financiera para pymes y empresas medianas. Su usuario principal no es un desarrollador ni un contador técnico, sino un dueño, CEO, CFO, gerente de administración y finanzas o controller que necesita control financiero práctico.

El frontend debe permitir que el usuario entienda rápidamente caja, cobranza, pagos, resultado, alertas, estructura de gestión y clasificación de movimientos. La complejidad del modelo vive en backend; el frontend debe traducirla a una experiencia simple, accionable y confiable.

No debe sentirse como ERP.

No debe sentirse como software contable tradicional.

No debe sentirse como una planilla Excel con gráficos.

No debe mostrar conceptos técnicos internos como canonical_category, financial_impact, taxonomy_node o dimension_assignment al usuario final.

Debe hablar en lenguaje de negocio: caja, cobrar, pagar, resultado, estructura de gestión, vistas de gestión, monedas, reglas, movimientos por clasificar.

## 2. Estado actual que debe asumir Claude Code

| Elemento          | Estado que debe asumir                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend          | C1-prep terminado. No parte desde cero.                                                                                                   |
| Backend           | C1 desarrollado 100%; C2 implementado; PR 72 contexto actual/posterior.                                                                   |
| Siguiente paso FE | PR #83 - integración FE post-handoff backend, Paso 6 del runbook.                                                                         |
| Repos             | qavante-web separado de qavante-api.                                                                                                      |
| Contrato técnico  | OpenAPI generado desde FastAPI.                                                                                                           |
| Stack FE          | Next.js 15 + App Router + TypeScript strict + shadcn + TanStack Query + Zustand + RHF/Zod + TanStack Table + Recharts + Cloudflare Pages. |
| Navegación base   | 6 módulos visibles: Inicio, Caja, Cobrar, Pagar, Gestión, Administración.                                                                 |
| Infra             | Cloudflare Pages, Edge Runtime obligatorio en pages/routes/middleware según estándar del proyecto.                                        |
| Regla crítica     | No romper C0/C1-prep ni navegación existente.                                                                                             |

## 3. Objetivo del addendum frontend

El objetivo es convertir el handoff backend de taxonomía, clasificación, dimensiones, plantillas y multimoneda en una experiencia frontend clara, estable y extensible.

Consumir correctamente los nuevos contratos OpenAPI del backend.

Exponer en UI la estructura de gestión sin llamar a eso taxonomía.

Permitir configurar categorías de gestión con árbol, anidación, visibilidad, activación y orden.

Permitir configurar vistas de gestión, que técnicamente corresponden a management_dimensions.

Permitir clasificar movimientos bancarios con tipo de movimiento, categoría de gestión y vistas de gestión.

Permitir configurar monedas: moneda principal, UF como unidad indexada y USD/otras monedas de reporte.

Permitir usar plantillas por tipo de negocio como sugerencia, sin rigidez por industria.

Dejar preparado visualmente el camino para Fase 2: presupuesto, forecast, escenarios, drivers, inversiones, deuda e IA financiera, sin implementarlo todo ahora.

## 4. Fuente de verdad y reglas de prioridad

| Prioridad | Fuente                      | Regla                                                                                               |
| --------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| 1         | Código real del repo        | Si el repo real contradice esta especificación, detenerse y documentar brecha. No improvisar.       |
| 2         | OpenAPI vigente del backend | Contrato técnico para tipos, endpoints, request/response y errores.                                 |
| 3         | Documento Maestro v2.6.4    | Decisiones de producto, stack, navegación, sprints y arquitectura general.                          |
| 4         | Kit Sprint C0               | Reglas de setup, CI, Edge Runtime, TypeScript, navegación y conexión API.                           |
| 5         | Este addendum               | Especificación de UX e integración para taxonomía, clasificación, multimoneda y preparación Fase 2. |

Restricción obligatoria: Si OpenAPI no contiene un endpoint necesario, no crear tipos manuales definitivos. Usar feature flag, placeholder o adapter temporal claramente marcado como TODO: remove after backend handoff.

## 5. Alcance y no alcance

### 5.1 Incluido en Fase 1 / PRs derivados

Integración post-handoff backend PR #83.

Regeneración de tipos OpenAPI.

Clientes y hooks de datos para canonical categories, management accounts, dimensions, industry templates, currencies, classification rules y bank movement classification.

Pantalla Administración > Estructura de gestión.

Pantalla Administración > Vistas de gestión.

Pantalla Administración > Monedas.

Pantalla Administración > Reglas de clasificación.

Flujo de movimientos por clasificar desde Caja o Gestión, según navegación existente.

Selectores reutilizables: CanonicalCategorySelect, ManagementAccountSelect, DimensionValuePicker, CurrencySelector, IndustryTemplateSelector.

Manejo de permisos, estados vacíos, errores, loading, skeletons y estados sin backend completo.

Tests unitarios, integración y E2E de flujos críticos.

### 5.2 Excluido de PR #83

Rehacer navegación principal.

Rediseñar dashboards de Inicio, Caja, Cobrar, Pagar o Gestión completos.

Implementar IA financiera predictiva.

Implementar presupuesto avanzado completo.

Implementar forecast avanzado completo.

Implementar escenarios avanzados completos.

Crear mocks permanentes cuando el backend no expone un endpoint.

Editar manualmente tipos OpenAPI generados.

Instalar librerías nuevas sin justificación explícita y PR propio si cambia arquitectura.

Mostrar términos técnicos internos al usuario final.

## 6. PR #83 - Integración FE post-handoff backend

Decisión de arquitectura: El PR #83 debe ser un PR de integración, no de rediseño visual completo. Debe conectar el frontend con el contrato backend y dejar la base lista para las pantallas funcionales siguientes.

### 6.1 Objetivo exacto de PR #83

Consumir el OpenAPI actualizado del backend.

Regenerar tipos sin edición manual.

Agregar/adaptar API client functions y TanStack Query hooks para nuevos endpoints.

Agregar feature flags para módulos de estructura de gestión, vistas de gestión, monedas, reglas y clasificación si backend aún está parcial.

Crear rutas y shell de pantallas nuevas con estados reales de carga/error/empty, sin dejar UI mock engañosa.

Agregar integración mínima de metadata: canonical categories, management accounts tree, dimensions, currencies y industry templates.

Dejar pruebas base para confirmar que el handoff backend se consume correctamente.

No implementar drag and drop complejo si el backend no tiene move endpoint confirmado.

### 6.2 Checklist de preflight obligatorio antes del PR #83

git status

npm run lint

npm run typecheck

npm run test

npm run build

npm run generate:api

npm run typecheck

Confirmar que generate:api produce cambios esperados y revisables.

Confirmar que no se editó manualmente src/lib/api/types.ts.

Confirmar que NEXT_PUBLIC_API_URL apunta al backend correcto para staging/local.

Confirmar que /health-lite o endpoint equivalente responde desde frontend.

Confirmar que cookies/auth actuales siguen funcionando.

Confirmar que rutas existentes de C1-prep no se rompen.

### 6.3 Salida esperada de Claude Code antes de programar PR #83

Lista de endpoints detectados en OpenAPI relacionados con este addendum.

Lista de endpoints faltantes o con shape distinto.

Archivos que tocará.

Hooks que creará.

Rutas que creará.

Feature flags necesarios.

Riesgos de integración.

Confirmación explícita: no editaré tipos generados manualmente.

Confirmación explícita: no modificaré navegación principal de seis módulos.

Confirmación explícita: no implementaré Fase 2 funcional en PR #83.

## 7. Restricciones técnicas del frontend

| Área           | Regla obligatoria                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Next.js        | Usar App Router. Mantener Edge Runtime en pages/routes/middleware donde aplique según estándar del proyecto. |
| TypeScript     | strict habilitado. No usar any salvo justificación local y comentario.                                       |
| API            | Usar cliente API central. No hacer fetch directo disperso desde componentes.                                 |
| OpenAPI        | Tipos generados. No editar archivo generado.                                                                 |
| TanStack Query | Usar query keys estables y hooks por dominio.                                                                |
| Zustand        | Solo estado UI local/global necesario, no duplicar cache server-state.                                       |
| RHF/Zod        | Formularios con validación explícita y mensajes humanos.                                                     |
| shadcn/ui      | Usar componentes existentes y wrappers Qavante si ya existen.                                                |
| TanStack Table | Tablas de movimientos/reglas/categorías si aplica.                                                           |
| Recharts       | Solo para gráficos existentes o Fase 2; no usar para configuración.                                          |
| Accesibilidad  | Foco visible, keyboard navigation, labels, aria donde aplique.                                               |
| Performance    | No cargar librerías pesadas globalmente. Code splitting para pantallas admin.                                |

## 8. Lenguaje de producto y microcopy

Decisión de arquitectura: El usuario no debe ver conceptos técnicos internos. La UI debe traducirlos a lenguaje ejecutivo y operativo.

| Concepto técnico    | Texto visible recomendado             | No usar como etiqueta visible                 |
| ------------------- | ------------------------------------- | --------------------------------------------- |
| CanonicalCategory   | Tipo de movimiento                    | canonical_category, categoría canónica        |
| ManagementAccount   | Categoría de gestión                  | management_account, cuenta de gestión técnica |
| ManagementDimension | Vista de gestión                      | dimensión, dimension_id                       |
| IndustryTemplate    | Base sugerida / plantilla del negocio | industry profile                              |
| ClassificationRule  | Regla de clasificación                | rule engine                                   |
| FinancialImpact     | Impacto financiero                    | financial impact                              |
| Currency settings   | Monedas                               | company_currency_settings                     |
| Unknown             | Por clasificar                        | unknown                                       |

### 8.1 Microcopy obligatorio

Estructura de gestión: “Define cómo Qavante ordena tus ingresos, costos, gastos, caja y obligaciones. Puedes partir con la estructura sugerida y ajustarla a tu negocio.”

Vistas de gestión: “Agrega formas de mirar tu negocio: por cliente, proyecto, obra, local, sociedad, activo, canal u otra variable relevante.”

Monedas: “Define la moneda principal de tu empresa y las monedas en que quieres ver tus reportes.”

Clasificación: “Qavante no modificará el movimiento original del banco. Solo agregará una clasificación de gestión.”

Reglas: “Las reglas ayudan a que Qavante clasifique automáticamente movimientos similares en el futuro.”

Plantillas: “Selecciona la base que más se parece a tu negocio. Después podrás ajustarla.”

## 9. Navegación y rutas

Restricción obligatoria: Mantener los seis módulos principales: Inicio, Caja, Cobrar, Pagar, Gestión y Administración. No agregar “Taxonomía” como módulo principal.

| Módulo         | Ruta base       | Uso                                                                                                     |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| Inicio         | /inicio         | Resumen ejecutivo, Pulso, alertas y acciones prioritarias. No implementar en este addendum salvo links. |
| Caja           | /caja           | Caja real/proyectada y movimientos por clasificar si la estructura actual lo permite.                   |
| Cobrar         | /cobrar         | Cuentas por cobrar. No rediseñar en PR #83.                                                             |
| Pagar          | /pagar          | Cuentas por pagar. No rediseñar en PR #83.                                                              |
| Gestión        | /gestion        | Resultado operacional, drivers, futuro presupuesto/forecast/escenarios. Preparar sin implementar todo.  |
| Administración | /administracion | Configuración de empresa, usuarios, estructura de gestión, vistas, monedas, reglas.                     |

### 9.1 Nuevas rutas internas recomendadas

src/app/(app)/administracion/estructura-gestion/page.tsx

src/app/(app)/administracion/vistas-gestion/page.tsx

src/app/(app)/administracion/monedas/page.tsx

src/app/(app)/administracion/reglas-clasificacion/page.tsx

src/app/(app)/caja/por-clasificar/page.tsx # solo si la navegación actual de Caja lo permite

Todas las páginas nuevas deben declarar runtime edge si el estándar del repo lo exige.

No crear rutas paralelas con nombres técnicos como /taxonomy, /dimensions o /canonical-categories.

Si el repo ya usa rutas con prefijo /app, respetar convención real existente.

No romper sidebar actual; agregar subitems en Administración si el shell ya soporta subnavegación. Si no soporta, agregar links desde la landing de Administración.

## 10. Contratos API que debe consumir el frontend

Restricción obligatoria: Estos contratos deben venir desde OpenAPI. Si el backend aún no los expone, el frontend no debe inventar tipos definitivos.

### 10.1 Canonical categories

GET /api/treasury/canonical-categories

Response esperado:

{

"items": [

    {

      "code": "client_collection",

      "label": "Cobro de cliente",

      "description": "Cobro recibido desde cliente o deudor comercial.",

      "expected_direction": "credit",

      "cashflow_group": "cash_in",

      "default_financial_model": "cash_flow",

      "default_impact_type": "cash_in",

      "default_management_root": "accounts_receivable",

      "requires_review": false,

      "affects_operational_result_by_default": false,

      "is_internal_movement": false,

      "allowed_for_bank_movement": true,

      "sort_order": 10

    }

]

}

### 10.2 Management accounts tree

GET /api/management/accounts/tree

POST /api/management/accounts

PATCH /api/management/accounts/{account_id}

POST /api/management/accounts/{account_id}/move

POST /api/management/accounts/{account_id}/toggle-active

POST /api/management/accounts/{account_id}/toggle-visible

Nodo esperado:

{

"id": "uuid",

"parent_id": "uuid|null",

"code": "operating_expense.software_technology",

"name": "Software y tecnología",

"display_name": "Software y tecnología",

"description": "...",

"account_type": "operating_expense",

"destination": "operational_income_statement",

"level": 1,

"path": "operating_expense/software_technology",

"sort_order": 40,

"is_system": true,

"is_visible": true,

"active": true,

"affects_pulso": true,

"children": []

}

### 10.3 Industry templates

GET /api/management/industry-templates

GET /api/management/industry-templates/{template_code}

POST /api/management/industry-templates/{template_code}/apply

Request apply:

{

"mode": "suggest_only",

"overwrite_existing": false

}

Modes permitidos:

suggest_only | add_missing | replace_visibility

### 10.4 Management dimensions

GET /api/management/dimensions

POST /api/management/dimensions

PATCH /api/management/dimensions/{dimension_id}

GET /api/management/dimensions/{dimension_id}/values

POST /api/management/dimensions/{dimension_id}/values

PATCH /api/management/dimension-values/{value_id}

POST /api/management/dimension-values/{value_id}/move

Dimension:

{

"id": "uuid",

"code": "proyecto",

"name": "Proyecto",

"description": "Permite analizar ingresos, costos, margen y caja por proyecto.",

"data_type": "text",

"is_required": false,

"is_visible": true,

"allows_hierarchy": true,

"allows_multiple_values": false,

"sort_order": 10,

"active": true

}

### 10.5 Dimension assignments

POST /api/management/dimension-assignments

DELETE /api/management/dimension-assignments/{assignment_id}

GET /api/management/dimension-assignments?entity_type=bank_movement&entity_id=uuid

entity_type Fase 1:

bank_movement | document | manual_entry

### 10.6 Currencies

GET /api/core/currencies

GET /api/core/exchange-rates?base=UF&quote=CLP&date=2026-05-15

GET /api/core/company-currency-settings

PATCH /api/core/company-currency-settings

Currencies mínimas:

CLP, UF, USD, EUR, PEN, COP, MXN, BRL

### 10.7 Bank movement classification

POST /api/treasury/bank-movements/{bank_movement_id}/classify

POST /api/treasury/bank-movements/{bank_movement_id}/suggest-rule

GET /api/treasury/classification-rules

POST /api/treasury/classification-rules

PATCH /api/treasury/classification-rules/{rule_id}

POST /api/treasury/classification-rules/{rule_id}/toggle-active

## 11. Labels humanos para tipos de movimiento

El frontend debe consumir labels desde backend. Esta tabla sirve como expectativa de UX y fallback solo para tests o documentación, no como fuente de verdad hardcodeada en UI.

| code                        | Label UI                            | Dirección | Uso                                                                        |
| --------------------------- | ----------------------------------- | --------- | -------------------------------------------------------------------------- |
| client_collection           | Cobro de cliente                    | credit    | Entrada de caja de cliente o deudor comercial.                             |
| card_processor_settlement   | Abono procesador de pago            | credit    | Abono desde Transbank, MercadoPago, Getnet, Klap u otro procesador.        |
| cash_deposit                | Depósito de efectivo                | credit    | Depósito de efectivo, recaudación o caja diaria.                           |
| supplier_payment            | Pago a proveedor                    | debit     | Pago comercial u operacional a proveedor.                                  |
| payroll_payment             | Pago de remuneraciones              | debit     | Pago de sueldos, anticipos, finiquitos o nómina.                           |
| tax_payment                 | Pago de impuestos                   | debit     | IVA, PPM, renta u otro impuesto.                                           |
| social_security_payment     | Pago previsional / Previred         | debit     | Cotizaciones, salud, AFC, mutualidad o Previred.                           |
| tgr_payment                 | Pago TGR                            | debit     | Tesorería General de la República u obligación fiscal equivalente.         |
| bank_fee                    | Comisión bancaria                   | debit     | Cargo bancario, mantención o comisión.                                     |
| interest_income             | Intereses recibidos                 | credit    | Ingreso financiero por intereses.                                          |
| interest_expense            | Intereses pagados                   | debit     | Gasto financiero por intereses.                                            |
| debt_disbursement           | Crédito recibido                    | credit    | Desembolso de préstamo, crédito o línea de financiamiento.                 |
| debt_service                | Pago de deuda                       | debit     | Pago de cuota, leasing, amortización o deuda.                              |
| factoring_advance           | Anticipo de factoring               | credit    | Abono por factoring o anticipo de facturas.                                |
| factoring_cost_or_repayment | Costo o pago factoring              | debit     | Cargo, descuento, comisión o pago asociado a factoring.                    |
| owner_contribution          | Aporte de socio                     | credit    | Aporte patrimonial de socio o accionista.                                  |
| owner_withdrawal            | Retiro / dividendo socio            | debit     | Retiro, dividendo o distribución a socio.                                  |
| internal_bank_transfer      | Transferencia entre cuentas propias | any       | Movimiento entre cuentas de la misma empresa.                              |
| intercompany_transfer       | Transferencia relacionada           | any       | Movimiento entre empresas relacionadas.                                    |
| investment_purchase         | Compra de inversión                 | debit     | Compra de instrumento financiero o inversión.                              |
| investment_return           | Retorno de inversión                | credit    | Rescate, vencimiento o retorno de inversión.                               |
| capex_payment               | Pago CAPEX                          | debit     | Compra de activo fijo, maquinaria, vehículo, tecnología o infraestructura. |
| refund_or_reversal          | Devolución / reversa                | any       | Extorno, reversa o devolución.                                             |
| operational_expense         | Gasto operacional                   | debit     | Egreso operacional genérico.                                               |
| non_operational_income      | Ingreso no operacional              | credit    | Ingreso extraordinario o no recurrente.                                    |
| unknown                     | Por clasificar                      | any       | Movimiento sin clasificación suficiente.                                   |

## 12. API client, query keys y hooks obligatorios

El frontend debe centralizar la integración en lib/api y hooks por dominio. No hacer fetch directo en componentes de pantalla.

### 12.1 Query keys

export const qk = {

canonicalCategories: ['treasury', 'canonical-categories'] as const,

managementAccountsTree: ['management', 'accounts', 'tree'] as const,

industryTemplates: ['management', 'industry-templates'] as const,

managementDimensions: ['management', 'dimensions'] as const,

dimensionValues: (dimensionId: string) => ['management', 'dimensions', dimensionId, 'values'] as const,

currencies: ['core', 'currencies'] as const,

companyCurrencySettings: ['core', 'company-currency-settings'] as const,

classificationRules: ['treasury', 'classification-rules'] as const,

dimensionAssignments: (entityType: string, entityId: string) => ['management', 'dimension-assignments', entityType, entityId] as const,

};

### 12.2 Hooks mínimos

useCanonicalCategories()

useManagementAccountsTree()

useCreateManagementAccount()

useUpdateManagementAccount()

useMoveManagementAccount()

useToggleManagementAccountActive()

useToggleManagementAccountVisible()

useIndustryTemplates()

useApplyIndustryTemplate()

useManagementDimensions()

useCreateManagementDimension()

useUpdateManagementDimension()

useDimensionValues(dimensionId)

useCreateDimensionValue()

useMoveDimensionValue()

useCurrencies()

useCompanyCurrencySettings()

useUpdateCompanyCurrencySettings()

useClassificationRules()

useCreateClassificationRule()

useUpdateClassificationRule()

useToggleClassificationRuleActive()

useClassifyBankMovement()

useSuggestClassificationRule()

useDimensionAssignments(entityType, entityId)

### 12.3 Reglas de invalidación

Al crear/editar/mover management account, invalidar managementAccountsTree.

Al aplicar plantilla, invalidar managementAccountsTree, managementDimensions e industryTemplates si backend devuelve cambios.

Al crear/editar dimensión o valor, invalidar managementDimensions y dimensionValues(dimensionId).

Al clasificar movimiento, invalidar listados de movimientos por clasificar, caja si existe cache, classificationRules si create_rule=true y assignments del movimiento.

Al cambiar monedas, invalidar currencies, companyCurrencySettings y reportes que dependan de currency.

## 13. Feature flags y gating

Si el backend aún no entrega todos los endpoints, el frontend debe usar feature flags para liberar pantallas de manera segura, sin mocks engañosos.

| Flag                       | Uso                                                      | Default si backend no confirma |
| -------------------------- | -------------------------------------------------------- | ------------------------------ |
| managementAccounts         | Muestra Estructura de gestión.                           | false                          |
| managementDimensions       | Muestra Vistas de gestión.                               | false                          |
| industryTemplates          | Muestra selector/aplicación de base sugerida.            | false                          |
| multiCurrency              | Muestra configuración de monedas y selector de moneda.   | false                          |
| classificationRules        | Muestra reglas de clasificación.                         | false                          |
| bankMovementClassification | Muestra drawer de clasificación.                         | false                          |
| phase2PlanningPreview      | Muestra placeholders de presupuesto/forecast/escenarios. | false                          |

Las feature flags deben provenir de GET /api/management/config cuando exista. Si no existe, usar configuración local temporal claramente marcada como provisional.

## 14. Pantalla: Administración > Estructura de gestión

### 14.1 Ruta y propósito

Ruta: /administracion/estructura-gestion

Archivo sugerido: src/app/(app)/administracion/estructura-gestion/page.tsx

Título: Estructura de gestión

Subtítulo: Define cómo Qavante ordena tus ingresos, costos, gastos, caja y obligaciones. Puedes partir con la estructura sugerida y ajustarla a tu negocio.

### 14.2 Layout funcional

Header con título, subtítulo, estado de carga y botón “Aplicar base sugerida”.

Panel izquierdo: árbol de categorías con búsqueda, expandir/colapsar todo y filtros Activas/Ocultas/Sistema/Personalizadas.

Panel derecho: detalle de categoría seleccionada.

Footer contextual o toolbar: guardar cambios, cancelar, ver historial si existe.

Drawer/modal para crear categoría y subcategoría.

Modal de confirmación para cambios sensibles: mover categoría con hijos, ocultar categoría usada, desactivar categoría usada.

### 14.3 Componentes requeridos

ManagementAccountTreeEditor

ManagementAccountTreeNode

ManagementAccountDetailPanel

ManagementAccountCreateDialog

ManagementAccountMoveConfirmDialog

ManagementAccountBadges

IndustryTemplateApplyDialog

UnsavedChangesGuard

### 14.4 Campos visibles en detalle

| Campo UI       | Origen backend         | Editable          | Regla                                                |
| -------------- | ---------------------- | ----------------- | ---------------------------------------------------- |
| Nombre visible | display_name \|\| name | sí                | Requerido, máximo razonable 80 caracteres.           |
| Descripción    | description            | sí                | Opcional.                                            |
| Tipo           | account_type           | no en modo simple | Mostrar como badge humano.                           |
| Destino        | destination            | no en modo simple | Mostrar badge Caja/Resultado/Capital de trabajo/etc. |
| Afecta Pulso   | affects_pulso          | solo admin        | Mostrar badge.                                       |
| Activa         | active                 | sí                | Desactivar no borra datos.                           |
| Visible        | is_visible             | sí                | Ocultar no elimina datos.                            |
| Sistema        | is_system              | no                | Si true, no permitir borrar.                         |
| Orden          | sort_order             | por DnD           | No editar como número.                               |

### 14.5 Acciones

Crear categoría raíz, solo si rol permite.

Crear subcategoría bajo nodo seleccionado.

Editar nombre visible y descripción.

Activar/desactivar.

Mostrar/ocultar.

Mover por drag and drop si backend tiene move endpoint confirmado.

Restaurar o aplicar base sugerida sin borrar datos.

Ver dónde se usa, si backend provee conteo o usage endpoint.

### 14.6 Reglas críticas

No permitir eliminar físicamente una categoría desde frontend en Fase 1.

Si backend permite delete, no exponerlo todavía; usar desactivar/ocultar.

Si categoría tiene movimientos asociados, mostrar: “Esta categoría tiene movimientos asociados. Para mantener trazabilidad, no se puede eliminar.”

Si category is_system = true, permitir renombrar display_name si backend lo permite, pero no cambiar code, account_type ni destination.

Si backend rechaza move por ciclo, revertir UI y mostrar mensaje humano.

No mostrar JSON, IDs ni paths técnicos salvo modo debug no visible para usuario.

### 14.7 Estados vacíos y error

Sin estructura: “Qavante todavía no tiene una estructura de gestión para esta empresa. Puedes aplicar una base sugerida y ajustarla después.”

Sin permiso: “No tienes permisos para modificar la estructura de gestión. Puedes verla en modo lectura.”

Error de carga: “No pudimos cargar la estructura de gestión. Intenta nuevamente.”

Feature flag off: mostrar pantalla informativa, no ruta rota.

## 15. Pantalla: Administración > Vistas de gestión

### 15.1 Ruta y propósito

Ruta: /administracion/vistas-gestion

Archivo sugerido: src/app/(app)/administracion/vistas-gestion/page.tsx

Título: Vistas de gestión

Subtítulo: Agrega formas de mirar tu negocio: por cliente, proyecto, obra, local, sociedad, activo, canal u otra variable relevante.

### 15.2 Layout funcional

Vista principal con tarjetas de vistas activas e inactivas.

Cada tarjeta muestra nombre, descripción, estado, obligatoria/opcional, cantidad de valores y botón Gestionar.

Panel/drawer de gestión de valores para una vista seleccionada.

Árbol de valores con búsqueda, crear valor, crear subvalor, mover, activar/desactivar.

Botón “Agregar vista de gestión”.

### 15.3 Componentes requeridos

ManagementViewCardGrid

ManagementViewCard

ManagementViewCreateDialog

ManagementViewEditDialog

DimensionValueTreeEditor

DimensionValueTreeNode

DimensionValueCreateDialog

DimensionValueMoveConfirmDialog

### 15.4 Dimensiones sugeridas por plantilla

| Plantilla             | Vistas sugeridas                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| general_pyme          | Cliente, Proveedor, Centro de costo, Responsable, Cuenta bancaria                                                        |
| technology_services   | Cliente, Proyecto, Contrato, Línea de servicio, Consultor, Responsable comercial, Proveedor tecnológico, Tipo de ingreso |
| professional_services | Cliente, Proyecto, Socio/responsable, Consultor, Línea de servicio, Tipo de honorario                                    |
| construction          | Obra, Mandante, Contrato, Estado de pago, Partida, Subcontratista, Jefe de obra, Ubicación, Maquinaria                   |
| gastronomy            | Local, Turno, Canal de venta, Familia de producto, Medio de pago, Proveedor, Caja diaria, Día de semana                  |
| retail                | Tienda, Canal de venta, SKU, Marca, Categoría de producto, Medio de pago, Vendedor                                       |
| ecommerce             | Canal de venta, Marketplace, SKU, Marca, Medio de pago, Courier, Campaña                                                 |
| import_export         | Proveedor extranjero, Embarque, Incoterm, Contenedor, País de origen, Producto, Agente de aduana                         |
| manufacturing         | Planta, Línea de producción, Producto, Insumo, Lote, Orden de producción, Turno                                          |
| equipment_rental      | Equipo, Familia de equipo, Contrato, Cliente, Faena, Estado de equipo, Responsable                                       |
| real_estate           | Propiedad, Proyecto, Arrendatario, Corredor, Contrato, Activo, Ubicación                                                 |
| family_office         | Sociedad, Activo, Instrumento financiero, Banco, Beneficiario, Empresa relacionada, Tipo de inversión, País              |

### 15.5 Reglas UX

No usar la palabra “dimensiones” como título principal.

Permitir crear vista custom sin depender de plantilla.

No permitir borrar una vista usada; solo desactivar.

Si allows_multiple_values = false, UI no debe permitir seleccionar múltiples valores en clasificación.

Si allows_hierarchy = false, ocultar opción crear subvalor.

Al mover valores en árbol, revertir optimistically si backend rechaza.

## 16. Pantalla: Administración > Monedas

Ruta: /administracion/monedas

Título: Monedas

Subtítulo: Define la moneda principal de tu empresa y las monedas en que quieres ver tus reportes.

### 16.1 Componentes requeridos

CurrencySettingsPanel

CurrencySelector

ReportingCurrenciesMultiSelect

IndexedUnitToggle

ExchangeRateStatusCard

MissingExchangeRateAlert

### 16.2 Campos UI

| Campo UI                  | Backend                         | Regla                                                   |
| ------------------------- | ------------------------------- | ------------------------------------------------------- |
| Moneda principal          | functional_currency_code        | Requerida. Chile default CLP.                           |
| Usar UF                   | indexed_unit_enabled            | Solo mostrar UF si backend la expone como indexed_unit. |
| Unidad indexada           | indexed_unit_currency_code      | Default UF para Chile si enabled.                       |
| Monedas de visualización  | reporting_currency_codes        | CLP, UF, USD sugeridas para Chile.                      |
| Moneda de reporte default | default_reporting_currency_code | Puede ser CLP.                                          |
| Fuente de tipo de cambio  | default_exchange_rate_source    | Solo si backend la expone.                              |

### 16.3 Reglas

No mostrar UF si indexed_unit_enabled=false o si backend no la entrega.

No bloquear toda la pantalla si falta tipo de cambio.

Si falta tipo de cambio, mostrar alerta: “Falta tipo de cambio para convertir algunos valores. Puedes cargarlo o revisar más tarde.”

Mostrar fecha del tipo de cambio cuando un reporte use moneda distinta.

No hacer conversiones financieras críticas en frontend si backend debe calcularlas. Frontend solo formatea lo recibido o solicita currency_code al endpoint.

## 17. Flujo: Movimientos por clasificar

Decisión de arquitectura: El usuario debe poder corregir movimientos sin entender el modelo interno. El drawer de clasificación es una pieza crítica de la experiencia.

Ruta sugerida: /caja/por-clasificar

Alternativa si navegación actual no lo permite: agregar acceso desde /caja o /administracion.

Título: Movimientos por clasificar

Subtítulo: Revisa los movimientos que Qavante no pudo clasificar con suficiente confianza.

### 17.1 Tabla de movimientos

| Columna            | Contenido                       | Regla                                              |
| ------------------ | ------------------------------- | -------------------------------------------------- |
| Fecha              | transaction_date                | Formato es-CL.                                     |
| Descripción        | description                     | Truncar con tooltip, no alterar glosa.             |
| Monto              | amount + currency_code          | Color/ícono según debit/credit si estándar existe. |
| Banco/cuenta       | bank_name/account label         | No mostrar número completo.                        |
| Tipo sugerido      | canonical_category label        | Usar metadata backend.                             |
| Categoría sugerida | management_account display_name | Si existe.                                         |
| Confianza          | confidence                      | Badge alta/media/baja.                             |
| Acción             | Clasificar                      | Abre drawer.                                       |

### 17.2 Drawer de clasificación

| Sección              | Campo                                                           | Componente                          |
| -------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Resumen movimiento   | Fecha, glosa, banco, monto, moneda                              | Read-only summary card              |
| Tipo de movimiento   | canonical_category                                              | CanonicalCategorySelect             |
| Categoría de gestión | management_account_id                                           | ManagementAccountSelect tree/search |
| Vistas de gestión    | dimension_assignments                                           | DimensionValuePicker                |
| Regla futura         | create_rule                                                     | Checkbox + RuleSuggestionPreview    |
| Notas                | notes                                                           | Textarea opcional                   |
| Acciones             | Guardar / Guardar y crear regla / Marcar por revisar / Cancelar | Buttons                             |

### 17.3 Request exacto al backend

POST /api/treasury/bank-movements/{bank_movement_id}/classify

{

"canonical_category": "supplier_payment",

"management_account_id": "uuid",

"dimension_assignments": [

    {"dimension_id": "uuid", "dimension_value_id": "uuid"}

],

"notes": "Pago mensual proveedor Microsoft",

"create_rule": false

}

### 17.4 Reglas críticas

No editar glosa bancaria original.

No editar fecha o monto original.

No mostrar IDs técnicos.

Si canonical category es unknown/Por clasificar, guardar como needs_review si backend lo responde.

Si backend devuelve dirección esperada distinta al movimiento, mostrar advertencia no bloqueante.

Si create_rule = true, mostrar preview de la regla antes de enviar si backend lo permite.

Después de guardar, invalidar lista de movimientos por clasificar y detalle del movimiento.

## 18. Pantalla: Administración > Reglas de clasificación

Ruta: /administracion/reglas-clasificacion

Título: Reglas de clasificación

Subtítulo: Revisa las reglas que Qavante usa para clasificar movimientos similares en el futuro.

### 18.1 Tabla

| Columna              | Descripción                                                        |
| -------------------- | ------------------------------------------------------------------ |
| Nombre               | Nombre de la regla.                                                |
| Condición            | Campo + operador + valor. Ejemplo: descripción contiene Microsoft. |
| Tipo de movimiento   | Label humano de canonical category.                                |
| Categoría de gestión | display_name de management account.                                |
| Vistas asignadas     | Resumen de dimension assignments.                                  |
| Confianza            | confidence como badge.                                             |
| Estado               | Activa/Inactiva.                                                   |
| Acciones             | Editar, desactivar, probar si backend existe.                      |

### 18.2 Reglas UX

No exponer regex como opción inicial salvo modo avanzado.

Si una regla fue creada desde clasificación, mostrar origen: “Creada desde movimiento”.

Desactivar regla no borra historia.

No permitir que viewer active/desactive reglas.

Si backend aún no tiene “probar regla”, no inventar resultado.

## 19. Plantillas por tipo de negocio

Las plantillas son una base sugerida. No deben sentirse como una restricción por industria. Los ejemplos Tooxs, CKM, La Pocha y Elyon validan casos reales, pero Qavante debe verse amplio para pymes de múltiples rubros.

### 19.1 Catálogo UI mínimo

| Plantilla UI                     | Texto visible                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| General pyme                     | Para empresas que quieren partir simple con ingresos, costos, gastos, caja, cobrar y pagar.                              |
| Tecnología / servicios digitales | Para empresas que venden proyectos, servicios, licencias, contratos recurrentes o soluciones digitales.                  |
| Servicios profesionales          | Para empresas que venden horas, proyectos, asesorías, consultoría o servicios especializados.                            |
| Construcción / obras             | Para empresas que controlan obras, estados de pago, subcontratos, materiales y costos por proyecto.                      |
| Gastronomía                      | Para restaurantes, cafeterías o negocios con ventas diarias, locales, canales y costos de alimentos.                     |
| Retail / comercio                | Para empresas con tiendas, productos, marcas, medios de pago, inventario y margen por categoría.                         |
| Ecommerce                        | Para negocios con ventas online, marketplaces, campañas, courier y medios de pago digitales.                             |
| Importadora / distribuidora      | Para empresas que compran, importan, distribuyen y controlan margen por producto, proveedor o embarque.                  |
| Manufactura / producción         | Para empresas que producen, transforman insumos y controlan costos por planta, línea, producto o lote.                   |
| Arriendo de maquinaria / equipos | Para empresas que arriendan activos, equipos o maquinaria y controlan utilización, contratos, mantención y rentabilidad. |
| Inmobiliaria / propiedades       | Para administrar propiedades, arriendos, activos, contratos, gastos comunes, deuda y flujo por activo.                   |
| Family office / inversiones      | Para administrar sociedades, inversiones, activos, bancos, monedas, deuda y distribuciones.                              |
| Otro                             | Para partir desde una estructura general y personalizarla.                                                               |

### 19.2 Apply template flow

Paso 1: seleccionar plantilla.

Paso 2: mostrar preview de categorías y vistas sugeridas.

Paso 3: elegir modo: solo sugerir, agregar faltantes o ajustar visibilidad.

Paso 4: confirmar que no se borrarán datos.

Paso 5: aplicar y mostrar resumen de cambios.

POST /api/management/industry-templates/{template_code}/apply

{

"mode": "suggest_only",

"overwrite_existing": false

}

Regla FE:

- suggest_only no debe actualizar UI como si se hubiese aplicado.

- add_missing debe invalidar accounts/dimensions.

- replace_visibility debe mostrar confirmación reforzada.

## 20. Componentes frontend requeridos

| Componente                   | Responsabilidad                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| CanonicalCategorySelect      | Selector de tipo de movimiento con labels humanos, búsqueda, descripción y dirección esperada. |
| ManagementAccountSelect      | Selector de categoría de gestión usando árbol/buscador.                                        |
| ManagementAccountTreeEditor  | Editor de árbol de estructura de gestión.                                                      |
| ManagementAccountTreeNode    | Nodo reutilizable con badges, acciones y DnD si está habilitado.                               |
| ManagementAccountDetailPanel | Panel derecho de edición/lectura de categoría.                                                 |
| ManagementViewCardGrid       | Grilla de vistas de gestión activas/inactivas.                                                 |
| DimensionValueTreeEditor     | Editor de valores jerárquicos de una vista.                                                    |
| DimensionValuePicker         | Selector de valores para clasificación.                                                        |
| CurrencySettingsPanel        | Configuración de moneda principal, UF, monedas de reporte.                                     |
| IndustryTemplateSelector     | Selector amplio de bases sugeridas por tipo de negocio.                                        |
| IndustryTemplateApplyDialog  | Preview y confirmación de aplicación de plantilla.                                             |
| ClassificationDrawer         | Drawer principal para clasificar movimiento.                                                   |
| ClassificationRuleModal      | Crear/editar regla de clasificación.                                                           |
| FeatureUnavailableState      | Estado cuando backend/flag aún no habilita funcionalidad.                                      |
| UnsavedChangesGuard          | Protección contra pérdida de cambios.                                                          |
| PermissionGate               | Oculta/inhabilita acciones según rol/permisos.                                                 |

## 21. Drag and drop y anidación

Restricción obligatoria: No instalar una librería DnD nueva dentro de PR #83 salvo que el proyecto ya la tenga o Fernando apruebe un PR específico. Si se instala, preferir @dnd-kit/core y @dnd-kit/sortable por estabilidad y accesibilidad.

### 21.1 Reglas de DnD

Debe soportar reordenar dentro del mismo padre.

Debe soportar mover a otro padre si backend lo permite.

Debe impedir soltar un nodo dentro de sí mismo o sus descendientes.

Debe mostrar preview visual claro.

Debe hacer optimistic update solo con rollback implementado.

Si backend rechaza por ciclo, revertir y mostrar: “No se puede mover ahí porque generaría una relación circular.”

Debe ser accesible por teclado o tener alternativa de mover desde menú.

### 21.2 Payload move esperado

POST /api/management/accounts/{account_id}/move

{

"new_parent_id": "uuid|null",

"sort_order": 30

}

POST /api/management/dimension-values/{value_id}/move

{

"new_parent_id": "uuid|null",

"sort_order": 30

}

## 22. Permisos y comportamiento por rol

| Función                       | owner/admin | finance_manager | viewer |
| ----------------------------- | ----------- | --------------- | ------ |
| Ver estructura de gestión     | sí          |                 |        |
| Crear/editar/mover categorías | sí          | no              |        |
| Ver vistas de gestión         | sí          |                 |        |
| Crear/editar vistas y valores | sí          | no              |        |
| Ver monedas                   | sí          |                 |        |
| Editar monedas                | sí          | no              |        |
| Ver reglas                    | sí          |                 |        |
| Crear/editar reglas           | sí          | no              |        |
| Clasificar movimientos        | sí          | no              |        |
| Aplicar plantillas            | sí          | no              |        |

Si el backend devuelve 403, mostrar mensaje humano y no ocultar errores.

Las acciones no permitidas deben ocultarse o quedar disabled con tooltip explicativo.

No confiar solo en frontend para permisos; backend manda.

El sidebar no debe mostrar subopciones si el usuario no tiene acceso a ninguna acción útil, salvo lectura permitida.

## 23. Manejo de errores y estados

| Código backend                  | Mensaje UI recomendado                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- |
| invalid_canonical_category      | El tipo de movimiento no es válido. Actualiza la página e intenta nuevamente. |
| invalid_management_account      | La categoría de gestión no es válida.                                         |
| management_account_not_found    | No encontramos esa categoría de gestión.                                      |
| management_account_cross_tenant | No puedes usar una categoría de otra empresa.                                 |
| dimension_not_found             | No encontramos esa vista de gestión.                                          |
| dimension_value_not_found       | No encontramos ese valor de vista de gestión.                                 |
| dimension_cycle_detected        | No se puede mover ahí porque generaría una relación circular.                 |
| category_cycle_detected         | No se puede mover esa categoría ahí porque generaría una relación circular.   |
| invalid_currency                | La moneda seleccionada no es válida.                                          |
| missing_exchange_rate           | Falta tipo de cambio para la fecha seleccionada.                              |
| classification_forbidden        | No tienes permisos para clasificar este movimiento.                           |
| bank_movement_not_found         | No encontramos ese movimiento bancario.                                       |
| rule_condition_invalid          | La condición de la regla no es válida.                                        |
| template_not_found              | No encontramos esa base sugerida.                                             |
| template_apply_conflict         | No se pudo aplicar la base sugerida por un conflicto de configuración.        |

### 23.1 Estados de carga

Loading inicial: skeletons, no spinners aislados si la pantalla completa depende de data.

Empty state: mensaje accionable con CTA si el rol puede actuar.

Error state: reintentar, y si corresponde link a soporte/admin.

Partial data: mostrar banner “Hay información pendiente de configurar” y no romper pantalla.

No permission: modo lectura o pantalla explicativa, según endpoint.

## 24. Archivos y estructura esperada

Claude Code debe adaptar nombres exactos al repo real, pero esta es la estructura objetivo mínima.

src/lib/api/client.ts

src/lib/api/types.ts # generado, no editar manualmente

src/lib/api/query-keys.ts

src/features/management-accounts/api.ts

src/features/management-accounts/hooks.ts

src/features/management-accounts/components/ManagementAccountTreeEditor.tsx

src/features/management-accounts/components/ManagementAccountDetailPanel.tsx

src/features/management-accounts/components/ManagementAccountSelect.tsx

src/features/management-dimensions/api.ts

src/features/management-dimensions/hooks.ts

src/features/management-dimensions/components/ManagementViewCardGrid.tsx

src/features/management-dimensions/components/DimensionValueTreeEditor.tsx

src/features/management-dimensions/components/DimensionValuePicker.tsx

src/features/industry-templates/api.ts

src/features/industry-templates/hooks.ts

src/features/industry-templates/components/IndustryTemplateSelector.tsx

src/features/industry-templates/components/IndustryTemplateApplyDialog.tsx

src/features/currencies/api.ts

src/features/currencies/hooks.ts

src/features/currencies/components/CurrencySettingsPanel.tsx

src/features/currencies/components/CurrencySelector.tsx

src/features/classification/api.ts

src/features/classification/hooks.ts

src/features/classification/components/CanonicalCategorySelect.tsx

src/features/classification/components/ClassificationDrawer.tsx

src/features/classification/components/ClassificationRuleModal.tsx

src/app/(app)/administracion/estructura-gestion/page.tsx

src/app/(app)/administracion/vistas-gestion/page.tsx

src/app/(app)/administracion/monedas/page.tsx

src/app/(app)/administracion/reglas-clasificacion/page.tsx

src/app/(app)/caja/por-clasificar/page.tsx

## 25. Preparación visual Fase 2

Fase 2 no debe implementarse funcionalmente en PR #83, pero el frontend debe quedar estructurado para no rediseñar después.

### 25.1 Resultado operacional

Debe usar categorías de gestión, no plan de cuentas ni canonical_category.

Ruta futura sugerida: /gestion/resultado.

Componentes futuros: OperationalResultTable, ResultBridge, VarianceBadge, ManagementAccountDrilldown.

Debe soportar filtros futuros por moneda, período, categoría, vista de gestión y escenario.

### 25.2 Presupuesto

Ruta futura sugerida: /gestion/presupuesto.

Componentes futuros: BudgetGrid, BudgetVersionSelector, BudgetDimensionFilter, BudgetImportDialog.

Debe apoyarse en financial_versions y future budget lines/financial impacts cuando backend lo entregue.

No construir grilla completa sin contrato backend.

### 25.3 Forecast

Ruta futura sugerida: /gestion/forecast.

Componentes futuros: ForecastBridge, ForecastVersionSelector, ForecastAssumptionsPanel, ForecastConfidenceBadge.

Debe mostrar Real acumulado + Compromisos + Proyección + Ajustes = Forecast cierre.

No calcular forecast crítico en frontend.

### 25.4 Escenarios

Ruta futura sugerida: /gestion/escenarios.

Componentes futuros: ScenarioBuilder, ScenarioAssumptionEditor, ScenarioComparisonTable, ScenarioImpactCards.

Debe soportar escenarios base, optimista, conservador, estrés caja, inversión, financiamiento, dólar alto, UF alta, atraso cobranza, pérdida cliente, nuevo proyecto, custom.

No inventar cálculo de escenarios si backend no entrega motor.

### 25.5 IA financiera

El asistente futuro debe explicar y consultar, no modificar datos sin confirmación.

No mostrar recomendaciones IA como verdades absolutas.

Toda proyección IA futura debe mostrar origen, confianza y supuestos cuando backend los entregue.

No implementar llamadas directas a Gemini desde frontend. El backend debe mediar.

## 26. Tests obligatorios

### 26.1 Unit tests

CanonicalCategorySelect renderiza labels humanos desde metadata.

ManagementAccountSelect renderiza árbol y búsqueda.

CurrencySelector oculta UF si no está activa.

DimensionValuePicker respeta allows_multiple_values.

IndustryTemplateSelector renderiza catálogo amplio sin hardcodear solo 4 industrias.

Error mapping traduce códigos backend a mensajes humanos.

PermissionGate oculta acciones según permisos.

### 26.2 Integration tests

Carga Estructura de gestión desde GET /api/management/accounts/tree.

Crea categoría y refresca árbol.

Mueve categoría y hace rollback si backend rechaza.

Carga Vistas de gestión y valores.

Asigna vista a movimiento en ClassificationDrawer.

Actualiza configuración de monedas.

Clasifica movimiento bancario con canonical category + management account + dimensions.

Crea regla desde clasificación si create_rule=true.

### 26.3 E2E tests Playwright

Admin entra a Administración > Estructura de gestión y ve árbol.

Admin crea subcategoría y la ve en árbol.

Admin entra a Vistas de gestión, crea valor hijo y lo ve anidado.

Finance manager clasifica movimiento desde Por clasificar.

Viewer no puede editar estructura ni clasificar.

Monedas muestra CLP/UF/USD cuando backend lo entrega.

UF no aparece si no está activada.

Error 403 muestra mensaje humano.

### 26.4 No regression

Login sigue funcionando.

Sidebar sigue mostrando seis módulos.

Rutas existentes de C1-prep siguen funcionando.

npm run lint/typecheck/test/build pasan.

generate:api no deja cambios manuales no revisados.

No aumenta bundle crítico de login o inicio por cargar componentes admin globalmente.

## 27. Secuencia de PRs recomendada

| PR     | Nombre                      | Contenido                                                                                   | No incluir                                          |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| #83    | FE post-handoff integration | generate:api, hooks base, query keys, feature flags, rutas skeleton, sanity tests.          | UI completa, DnD complejo, Fase 2.                  |
| #84    | Estructura de gestión       | Pantalla árbol categorías, create/edit/toggle, selector management account.                 | Vistas de gestión, monedas.                         |
| #85    | Vistas de gestión           | Pantalla de vistas, valores jerárquicos, selector DimensionValuePicker.                     | Clasificación bancaria completa.                    |
| #86    | Movimientos por clasificar  | ClassificationDrawer, CanonicalCategorySelect, classify mutation, create rule opcional.     | Reglas CRUD completo si es grande.                  |
| #87    | Monedas                     | CurrencySettingsPanel, CLP/UF/USD, missing exchange rate states.                            | Cálculo financiero avanzado.                        |
| #88    | Reglas de clasificación     | CRUD reglas, tabla, toggle, edición simple.                                                 | Motor IA o pruebas de reglas avanzadas sin backend. |
| #89    | Plantillas de negocio       | IndustryTemplateSelector, apply dialog, preview y add_missing.                              | Aplicación destructiva.                             |
| Fase 2 | Gestión avanzada            | Presupuesto, forecast, escenarios, drivers, IA financiera cuando backend entregue contrato. | Cálculos inventados en frontend.                    |

## 28. Definition of Done específico PR #83

Baseline ejecutado antes de cambios: lint, typecheck, test, build.

OpenAPI regenerado desde backend post-handoff.

Ningún tipo generado editado manualmente.

Hooks base creados para metadata principal.

Feature flags o config de disponibilidad implementada.

Rutas nuevas creadas como skeleton útil, con estado de carga/error/feature unavailable.

No se rompe sidebar ni navegación de seis módulos.

No se implementa Fase 2 funcional.

No hay uso de any sin justificación.

No se agregan dependencias nuevas salvo justificación explícita.

Tests mínimos de hooks/render pasan.

Build Cloudflare/Next compatible se mantiene.

README o changelog actualizado si el repo lo requiere.

## 29. Definition of Done final del addendum frontend

El frontend consume canonical categories desde backend y muestra labels humanos.

El usuario puede ver y ajustar estructura de gestión según permisos.

El usuario puede crear, editar, ocultar, activar/desactivar y mover categorías si backend lo permite.

El usuario puede ver y configurar vistas de gestión.

El usuario puede crear valores anidados para vistas de gestión.

El usuario puede clasificar movimientos con tipo, categoría de gestión y vistas.

El usuario puede crear una regla desde una clasificación cuando tiene permiso.

El usuario puede configurar moneda principal, UF y monedas de reporte.

El frontend no muestra términos técnicos internos.

La UI se mantiene simple para pymes de 1 a 3 usuarios.

RBAC se respeta en acciones visibles y backend sigue validando.

Feature flags impiden pantallas rotas cuando backend no está listo.

No se rompe C1-prep.

No se rompe navegación principal.

No se rompe login/auth.

No se implementa Fase 2 antes del contrato backend.

Queda preparado visualmente para resultado operacional, presupuesto, forecast, escenarios, drivers e IA financiera.

## 30. Stop conditions para Claude Code

Restricción obligatoria: Si ocurre cualquiera de estas condiciones, Claude Code debe detenerse y pedir decisión humana; no debe improvisar.

OpenAPI no expone endpoints requeridos por PR #83.

OpenAPI expone endpoints con nombres o shapes distintos a esta especificación.

Tipos generados rompen código existente masivamente.

Backend devuelve canonical_category como string libre sin metadata.

Backend no expone permisos suficientes para saber qué acciones mostrar.

Mover categorías requiere payload distinto no documentado.

No existe forma de listar management accounts tree.

No existe forma de distinguir UF como indexed_unit.

La ruta existente del proyecto no coincide con las rutas sugeridas.

Implementar DnD exige una dependencia nueva no aprobada.

El PR supera tamaño razonable y empieza a mezclar integración, UI completa y Fase 2.

## 31. Regla de oro frontend

Qavante debe sentirse simple para el usuario y robusto por debajo.

El backend contiene la complejidad: categorías canónicas, cuentas de gestión, dimensiones, monedas, reglas, escenarios y futuros impactos financieros.

El frontend debe traducir esa complejidad en decisiones claras:

- qué tipo de movimiento es;

- dónde impacta en la gestión;

- cómo quiero analizarlo;

- en qué moneda quiero verlo;

- qué queda pendiente por revisar;

- qué regla puede ahorrar trabajo futuro.

No construir una interfaz técnica.

No mostrar taxonomía como producto.

No inventar contratos.

No romper lo existente.

## 32. Frase final para Claude Code

Implementa esta especificación de manera incremental, conservadora y testeada.

Tu primer trabajo es PR #83: integración frontend post-handoff backend.

No rediseñes Qavante.

No modifiques la navegación principal.

No inventes tipos ni endpoints.

No edites OpenAPI generado manualmente.

No implementes Fase 2 funcional sin contrato backend.

No muestres conceptos técnicos al usuario final.

Convierte el modelo backend de taxonomía, clasificación, dimensiones y multimoneda en una experiencia clara para pymes: estructura de gestión, vistas de gestión, monedas, reglas y movimientos por clasificar.

## Anexo A — Checklist rápido para copiar al inicio de Claude Code

Antes de tocar código:

1. Lee esta especificación completa.

2. Revisa estado real del repo qavante-web.

3. Ejecuta lint/typecheck/test/build.

4. Verifica handoff backend y OpenAPI.

5. Ejecuta generate:api.

6. Lista endpoints detectados y faltantes.

7. Propón plan PR #83.

8. Confirma que no editarás types generados.

9. Confirma que no crearás mocks permanentes.

10. Confirma que no implementarás Fase 2 funcional en PR #83.
