# Contrato esperado — Resultado Operacional de Gestión (Sprint C5)

> ✅ **Verificado 2026-06-21 (CC-WEB):** shape vigente, idéntico a los types del FE (`src/lib/api/gestion.ts`). Construir contra esto — el flip del FE es inmediato al exponerse.

> **CC-WEB → CC-API. 2026-06-01.** Contrato **FE-first**: el FE construyó la
> pantalla de Gestión / Resultado Operacional (`/gestion`, Maestro §7.5 / §11.5)
> contra este contrato + MSW, **gated por el flag `operationalResult` (OFF en
> prod)**. El endpoint **aún no existe** en el backend. Cuando CC-API lo exponga
> con este shape (o uno cercano), corro `generate:api`, ajusto el adapter si
> hace falta y activo el flag. Tipos hand-rolled hoy en `src/lib/api/gestion.ts`.

## Endpoint

`GET /api/management/operational-result?period=YYYY-MM`

- **Auth:** cookie `qavante_session` (igual que tesorería C3 post-ADR-0027).
- **Param:** `period` = mes "YYYY-MM" (default: mes actual del tenant).
- **200** → `OperationalResultResponse` (abajo). **404/empty** si no hay datos
  del período (el FE muestra estado "sin datos", nunca asume 0 — Maestro §13).

## Semántica (Maestro C5 + C6)

- **Rule-based, NO ML / NO SHAP** (los drivers se calculan por reglas server-side).
- "Resultado **de gestión**, no contabilidad oficial" — el FE muestra ese badge
  obligatorio (no viene del backend).
- **No se asume faltante = 0**: si una fuente falta, baja la confianza y se
  lista en `missing_sources`; no se rellena con cero.
- Montos como **string-decimal** (igual que `cash-flow` / `financial_impacts`).

## Response shape

```jsonc
{
  "period": "2026-05",
  "revenue": "18500000", // ingresos
  "direct_cost": "7400000", // costos directos (proxy)
  "gross_margin": "11100000", // margen bruto (proxy)
  "gross_margin_pct": "60.0", // %
  "labor_cost": "4200000", // gasto laboral
  "professional_fees": "900000", // honorarios
  "recurring_expenses": "2100000", // gastos recurrentes
  "ebitda_proxy": "3900000", // EBITDA (proxy)
  "result": "3900000", // resultado operacional del mes
  "variation": {
    "vs_previous_month": { "amount": "600000", "pct": "18.2" }, // o null
    "vs_same_month_last_year": { "amount": "-300000", "pct": "-7.1" }, // o null
  },
  "drivers": [
    {
      "direction": "improves",
      "concept": "Ventas",
      "impact": "1200000",
      "explanation": "Más ventas que el mes anterior.",
    },
    {
      "direction": "worsens",
      "concept": "Sueldos",
      "impact": "-500000",
      "explanation": "Subió el gasto en remuneraciones.",
    },
  ],
  "confidence": "high", // high | medium | low
  "data_state": "available", // available | partial | estimated
  "missing_sources": [], // ej. ["Previred"] si falta una fuente
  "generated_at": "2026-06-01T12:00:00Z",
}
```

## Notas para CC-API

- `direction`: `improves` (mejora el resultado) / `worsens` (lo deteriora). El
  FE colorea verde/rojo y ordena por magnitud de `impact`.
- `gross_margin_pct` y `variation.*.pct` en string-decimal (ej. `"60.0"`, `"-7.1"`).
- Si el período no tiene datos, **404** (o 200 con `data_state` y montos null);
  el FE lo trata como "sin datos del período", no como cero.
- Endpoint sugerido para el flag (FLAG_GATING_ENDPOINT): `/api/management/operational-result`.
