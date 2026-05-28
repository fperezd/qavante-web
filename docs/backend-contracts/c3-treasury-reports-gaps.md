# Brechas backend — Sprint C3 waves 2-5 (CC-WEB → CC-API)

> Documento de **necesidades** del frontend `qavante-web` para completar Sprint C3
> ("¿Me alcanza la caja y qué puedo hacer?"). No es un contrato cerrado — es un
> brief para que CC-API + Fernando decidan el shape óptimo de cada endpoint.
>
> **Estado al escribir** (2026-05-28): Sprint C3 MVP ([PR #196](https://github.com/fperezd/qavante-web/pull/196))
> cableó `/caja/proyeccion` consumiendo el endpoint que ya existe:
>
> ```
> GET /api/treasury/reports/cash-flow
>   ?period_from&period_to&granularity&financial_layer
>   &group_by&account_id&currency&currency_code
>   &scenario_id&version_id&include_attention
> ```
>
> El MVP usa `granularity=week` + `period_from=mes_actual` + `period_to=mes_actual+3`
>
> - `financial_layer=committed` + `group_by=none`. La pantalla muestra **solo** lo
>   que el endpoint devuelve, sin inventar lógica financiera en FE
>   ([addendum frontend-v2 §25.3](../addendum/frontend-v2.md) + [ADR-0008](../adr/0008-feature-flags-gating-pantallas-sin-backend.md)).
>   Activación en prod: `NEXT_PUBLIC_FF_CASH_FLOW_REPORT=true` en Cloudflare Workers.

---

## Brechas para completar la promesa de Sprint C3

El doc maestro v2.6.4 §11 dice que `/caja` al cerrar C3 debe mostrar:

1. Flujo de caja a 13 semanas (✅ resuelto por el MVP — granularity=week + 3 meses).
2. **Brecha vs caja mínima** (❌ falta).
3. Columnas obligatorias: cobros, pagos, sueldos, impuestos, deuda (parcial — `group_by=canonical_category` ya soportado por backend, falta wiring FE).
4. **Acciones recomendadas** (❌ falta).

Y al cerrar C4–C5 cosas adyacentes:

5. **Selector de bank account** para filtrar el reporte por cuenta (`account_id` ya en endpoint, falta endpoint para listar opciones).
6. **Scenarios y versions** (`/api/planning/scenarios` ya existe — falta endpoint para listar versions de un scenario).

Las 4 brechas accionables van abajo. Cada una dice **qué necesita el FE**, **por qué**, y propone un **shape conservador** que CC-API puede ajustar.

---

## Brecha 1 — Caja mínima por tenant (bloqueante para "brecha vs caja mínima")

### Por qué

Para pintar la alerta de brecha (rojo si net acumulado < umbral mínimo) el FE necesita un número umbral por tenant. Hoy ese número no existe en ningún endpoint productivo.

### Necesidades del FE

- **Lectura**: traer el umbral configurado al montar `/caja/proyeccion`.
- **Escritura**: permitir a `role=owner|admin` editar el umbral desde `/administracion/caja-minima` (pantalla nueva que CC-WEB cablearía).
- Multi-moneda: si el tenant tiene varias monedas de reporte, el umbral debería poder ser por moneda (o forzado en moneda funcional + conversión visual).
- Auditoría: cambios al umbral deben loggearse (decisión sensible: cambiarlo enmascara alertas reales).

### Shape sugerido (conservador, CC-API ajusta)

```
GET /api/treasury/cash-minimum
→ 200 { thresholds: [{ currency_code: "CLP", amount: "5000000", updated_at, updated_by }] }
→ 404 { code: "not_configured" }  // tenant nuevo

PUT /api/treasury/cash-minimum
  body: { currency_code: "CLP", amount: "5000000" }
→ 200 { ... mismo shape que GET }
→ 403 si role != owner|admin
→ 422 si amount < 0 o currency_code no está en core.currencies activas del tenant
```

### Impacto en FE

- Nuevo hook `useCashMinimum()` en `src/lib/api/treasury.ts`.
- Nueva pantalla `/administracion/caja-minima` (form + audit log de cambios).
- En `CashFlowTable`: pintar la columna `net` en rojo cuando net acumulado < umbral, con tooltip explicativo.
- Nuevo flag `cashMinimum` en `FEATURE_FLAGS` con default OFF.

---

## Brecha 2 — Acciones recomendadas (motor + endpoint)

### Por qué

El addendum y el doc maestro hablan de "acciones recomendadas por la app". Hoy no hay motor que las genere ni endpoint para servirlas. CC-WEB **no** puede inventarlas (regla 5 del CLAUDE.md: cero lógica de negocio financiera en FE).

### Necesidades del FE

- Listar acciones contextuales en `/caja/proyeccion` y eventualmente `/inicio`.
- Tipos posibles (a confirmar con CC-API): `pay_supplier_now`, `collect_overdue`, `move_funds_between_accounts`, `request_credit_line`, etc.
- Cada acción con `priority` (high/medium/low), `description` (es-CL), `context_url` (link interno opcional, ej. `/pagar/facturas-recibidas?vencidas=true`), `expires_at` (opcional).
- Dismissible: el user puede marcar acciones como "no me interesa" — el backend debe persistir el dismiss.

### Shape sugerido (conservador)

```
GET /api/treasury/recommended-actions
  ?status=pending|dismissed|all  (default: pending)
  ?limit=20 (default 10, max 50)
→ 200 {
    items: [
      { id, type, priority, title, description, context_url?, expires_at?, created_at }
    ]
  }

PATCH /api/treasury/recommended-actions/{id}/dismiss
→ 204
```

### Impacto en FE

- Nuevo hook `useRecommendedActions()` y `useDismissAction()`.
- Componente `RecommendedActionsList` en `/caja/proyeccion` (panel lateral o top).
- En `/inicio` mostrar las 3 más prioritarias (cuando exista esa pantalla).
- Flag `recommendedActions` con default OFF.

### Decisión pendiente cross-agente

¿El motor de recomendaciones es heurístico (reglas duras tipo "si net 7d < 0 → pay_supplier_now") o LLM-driven? El CLAUDE.md regla 4 dice **no llamar al LLM directamente desde FE**, así que sea cual sea el motor vive en backend. Para CC-API decidir.

---

## Brecha 3 — Listado de bank accounts (selector de filtro)

### Por qué

El endpoint cash-flow ya acepta `account_id` como filtro. Pero el FE no sabe qué accounts existen para el tenant — no hay endpoint que liste `treasury.bank_accounts` con su `id` + `label` legible.

### Necesidades del FE

- Listado paginado (probablemente pocos elementos en práctica: <30 por tenant).
- `id`, `nombre` legible (alias del usuario, ej. "Cuenta corriente BancoEstado"), `bank_name`, `currency_code`, `account_type` (CC/Vista/Ahorro/etc.), `active` (bool).
- Ordenable por nombre o por uso reciente.

### Shape sugerido

```
GET /api/treasury/bank-accounts
  ?active=true (default: true; pasar false para incluir desactivadas)
→ 200 {
    items: [
      { id, name, bank_name, currency_code, account_type, active, last_movement_at? }
    ]
  }
```

### Impacto en FE

- Nuevo hook `useBankAccounts()` en `treasury.ts`.
- En `CashFlowFilters`: agregar selector `account_id` que muestra `name (bank_name)` con search-on-typing.
- También útil para futura pantalla `/administracion/cuentas-bancarias` (gestión).
- Flag `bankAccountSelector` opcional (también podría caer bajo `cashFlowReport` si el selector aparece dentro de esa pantalla).

---

## Brecha 4 — Scenario versions list (para selector multi-escenario)

### Por qué

`/api/planning/scenarios` ya devuelve la lista de scenarios. Pero un scenario puede tener varias **versions** (commits financieros — addendum §25). Para que el FE pueda mostrar selector "Escenario X / Versión Y" en filtros de cash-flow, falta endpoint que liste versions de un scenario.

### Necesidades del FE

- Listar versions de un scenario, ordenadas por fecha desc.
- `version_id`, `name` o `tag` legible, `created_at`, `created_by`, `is_active`.

### Shape sugerido

```
GET /api/planning/scenarios/{scenario_id}/versions
→ 200 {
    items: [
      { id, name, created_at, created_by, is_active, description? }
    ]
  }
```

### Impacto en FE

- Hook `useScenarioVersions(scenarioId)` en `src/lib/api/planning.ts` (nuevo archivo, sigue patrón treasury.ts).
- En `CashFlowFilters`: selector dependiente `scenario_id` → `version_id`.
- Out of scope para Sprint C3 MVP; útil cuando se construya `/gestion/forecast` (Fase 2 del addendum).

---

## Lo que NO va en este handoff

Cosas que el FE no necesita destrabar desde backend (porque ya tiene endpoint o no son C3):

- `group_by=canonical_category` / `group_by=management_account` ya está en el endpoint cash-flow — FE solo necesita agregar el wiring (wave 2 de C3, ticket interno).
- Filtros `currency` / `currency_code` también ya están en el endpoint.
- `include_attention` toggle también ya soportado — wave 4 cosmética.
- `/api/me`, `/api/auth/refresh`, etc. — no son C3.

---

## Cómo procesar este handoff

1. Fernando pasa este archivo a CC-API (mismo flujo del handoff `c1-sii-handoff-runbook.md`).
2. CC-API decide shape definitivo y abre PRs en `qavante-api`.
3. Para cada endpoint deployado:
   - Fernando avisa a CC-WEB.
   - CC-WEB corre `npm run generate:api` para traer los tipos nuevos.
   - CC-WEB abre PR cableando UI + tests + stories + flag por default OFF.
   - Activar el flag en prod cuando el endpoint esté estable.
4. Sprint C3 cerrado cuando las 4 brechas estén deployadas FE+BE.

Tiempo estimado del lado FE por brecha: 1-2 sesiones cortas cada una (hook + view/dialog + tests + stories + flag).

---

Generated by CC-WEB
