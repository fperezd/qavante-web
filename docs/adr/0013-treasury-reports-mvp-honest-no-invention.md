# ADR-0013: Treasury reports MVP — exponer crudo del backend, no inventar lógica financiera en FE

- **Status:** Accepted
- **Fecha:** 2026-05-28
- **Decididores:** Fernando
- **Tickets / PRs:** qavante-web #196, qavante-web #200

## Contexto

El doc maestro v2.6.4 §11 declara Sprint C3 con la entrega "flujo de caja a 13 semanas, brecha vs caja mínima, columnas obligatorias, acciones recomendadas". Al cablear el MVP (PR #196) salió a la luz una tensión:

- **Backend** ya expone `GET /api/treasury/reports/cash-flow` con todos los filtros (period, granularity, financial_layer, group_by, account_id, currency, scenario_id, version_id, include_attention). Devuelve buckets temporales agregados (`CashFlowReportResponse`).
- **Backend NO expone** todavía: caja mínima por tenant, motor de acciones recomendadas, listado de bank accounts, listado de versions de scenarios. Esas 4 brechas son del lado backend (CC-API).
- **Addendum frontend-v2 §25.3** dice explícitamente que "forecast avanzado completo" y "presupuesto, forecast, escenarios, drivers, IA financiera" son **Fase 2** ("cuando backend entregue contrato"), y que **no calcular forecast crítico en frontend**.
- **CLAUDE.md regla 5** prohíbe implementar lógica de negocio en FE (cálculo de Pulso, drivers, forecast, etc.).

Tres alternativas reales al momento de empezar Sprint C3:

1. **MVP honesto**: exponer el endpoint cash-flow que existe, tal cual, sin inventar brecha vs caja mínima ni acciones. Espera al backend para waves siguientes.
2. **MVP "completo" inventado en FE**: hardcodear caja mínima (ej. variable de tenant o env var) + hardcodear reglas de "acciones recomendadas" (ej. "si net 7d < 0 → sugerir cobrar"). Funciona visualmente pero viola regla 5 + ADR-0008 + addendum §25.3.
3. **No avanzar Sprint C3 hasta que el backend complete las 4 brechas**: bloquea visibilidad del producto, no cubre la promesa de "13 semanas" que sí podemos cumplir hoy.

## Decisión

**Optamos por la opción 1: MVP honesto.** En PR #196 cableamos `/caja/proyeccion` consumiendo el endpoint cash-flow tal cual, con defaults `granularity=week` + `mes_actual → mes_actual+3` ≈ 13 semanas + `financial_layer=committed`. La pantalla:

- Muestra solo lo que el backend devuelve (buckets temporales con inflow/outflow/net).
- NO inventa caja mínima — la columna `net` se pinta en rojo solo si el `net` del bucket es negativo (señal visual local del backend), no contra un umbral inexistente.
- NO inventa acciones recomendadas — el footer dice explícitamente "Caja mínima, alertas de brecha y acciones recomendadas vienen en Fase 2".
- Está gated por flag `cashFlowReport` con default OFF (ADR-0008 + ADR-0012).

Las **brechas backend** se documentan en [`docs/backend-contracts/c3-treasury-reports-gaps.md`](../backend-contracts/c3-treasury-reports-gaps.md) (PR #200) con shape conservador sugerido — CC-API ajusta y deploya. CC-WEB cablea wave por wave a medida que cada endpoint esté disponible:

- **Wave 2** (`group_by=canonical_category`): expansión de filas por categoría canónica. Endpoint backend ya soporta; falta wiring FE.
- **Wave 3** (caja mínima): nueva pantalla `/administracion/caja-minima` + alerta en `CashFlowTable`. Bloqueada por brecha 1.
- **Wave 4** (acciones recomendadas): panel en `/caja/proyeccion` + `/inicio`. Bloqueada por brecha 2.
- **Wave 5** (selector `account_id` + `scenario/version`): filtros avanzados. Bloqueada por brechas 3-4.

Cada wave es un PR independiente, con feature flag default OFF, sin invadir scope de la siguiente.

## Alternativas consideradas

- **Opción 2 — descartada:** MVP "completo" inventando caja mínima y reglas en FE. Razones:
  - Rompe regla 5 del CLAUDE.md y addendum §25.3.
  - Cualquier dato financiero hardcodeado en FE genera deuda: cuando el backend traiga su versión, hay que migrar usuarios reales que ya configuraron umbrales mock + reconciliar diferencias entre la lógica FE inventada y la lógica BE real. Difícil de revertir limpio.
  - El producto es financiero — la honestidad es proxy de confianza.

- **Opción 3 — descartada:** no avanzar Sprint C3. Razones:
  - Pierde momentum visible del producto.
  - El endpoint cash-flow ya está deployado en backend — bloquearnos a esperar las otras 4 brechas mientras la principal está lista es waste.
  - Permite validar UX (filtros, granularidad, capa) con datos reales antes de complicar con caja mínima/acciones.

## Consecuencias

### Positivas

- **Cero deuda de lógica financiera inventada** que migrar después.
- Sprint C3 visible para el usuario con activación de un flag (`NEXT_PUBLIC_FF_CASH_FLOW_REPORT=true`).
- Patrón replicable para Sprints C4-C8: cablear lo que el backend ya ofrece, documentar brechas, esperar contrato.
- Feature flag default OFF permite testear en prod sin riesgo (Fernando activa cuando esté listo).

### Negativas / tradeoffs aceptados

- La pantalla `/caja/proyeccion` NO cubre todavía la promesa completa del doc maestro §11 — el footer de `CashFlowTable` lo dice explícitamente para no confundir al usuario.
- Hay 4 PRs futuros bloqueados por backend (waves 2-5). El handoff doc minimiza el tiempo de espera al darle a CC-API shape claro.
- Algunos usuarios sofisticados pueden esperar la brecha vs caja mínima y se decepcionan. Mitigación: el footer informa con precisión qué viene cuando.

### Acciones que destraba o requiere

- [x] Sprint C3 MVP cableado (PR #196).
- [x] Handoff doc a CC-API documentado (PR #200).
- [x] Coverage de helpers puros del MVP (PR #199).
- [ ] CC-API decide shapes finales y deploya: caja mínima → wave 3.
- [ ] CC-API deploya: motor + endpoint acciones recomendadas → wave 4.
- [ ] CC-API deploya: `GET /api/treasury/bank-accounts` → wave 5 (parcial).
- [ ] CC-API deploya: `GET /api/planning/scenarios/{id}/versions` → wave 5 (parcial).
- [ ] CC-WEB cablea wave 2 (`group_by=canonical_category`) sin esperar backend — endpoint ya soporta.

## Referencias

- ADR-0008 — feature flags gating pantallas sin backend (default OFF).
- ADR-0012 — override flags en prod vía Cloudflare Workers env vars.
- [Doc maestro v2.6.4 §11 — Sprint C3](../../qavante_fase1_v2.6.4.docx).
- [Addendum frontend-v2 §25.3 + tabla "No hacer"](../addendum/frontend-v2.md).
- [`docs/backend-contracts/c3-treasury-reports-gaps.md`](../backend-contracts/c3-treasury-reports-gaps.md) — brechas backend con shapes sugeridos.
- PR #196 — implementación del MVP.
- PR #199 — coverage de helpers puros.
- PR #200 — handoff doc cross-repo.
