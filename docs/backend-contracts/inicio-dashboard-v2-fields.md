# Contrato esperado — campos extendidos del Inicio Ejecutivo v2

> **CC-WEB → CC-API. 2026-06-05.** El rediseño del Inicio (lente Xero, `/inicio/v2`,
> PR #303) agrega tres campos al MISMO endpoint `GET /api/dashboard/summary`. Son
> **FE-first** y **opcionales**: la vista degrada sola si faltan. Tipos hand-rolled
> en `src/lib/api/dashboard.ts` (`DashboardSummaryV2`). `generate:api` los reemplaza
> cuando el backend los exponga.

## Campos nuevos en `DashboardSummaryResponse`

```jsonc
{
  // ... los campos existentes (executive_phrase, pulso, cash_*, etc.) ...

  /** Tus fechas clave del mes (máx 3, por fecha). El estado lo calcula el backend
      contra la caja proyectada — el FE solo muestra y colorea. */
  "key_obligations": [
    {
      "key": "imposiciones",
      "label": "Imposiciones (Previred)",
      "due_date": "2026-06-10",
      "amount": "1100000",
      "coverage": "covered",
    },
    {
      "key": "impuestos_mensuales",
      "label": "Impuestos Mensuales (F29)",
      "due_date": "2026-06-12",
      "amount": "2400000",
      "coverage": "tight",
    },
    {
      "key": "sueldos",
      "label": "Sueldos",
      "due_date": "2026-06-30",
      "amount": "4200000",
      "coverage": "covered",
    },
  ],

  /** Puntos para el sparkline de caja (más reciente último; ej. saldo diario 30d). */
  "cash_sparkline": [61, 58, 64, 66, 70, 68, 72],

  /** Variación % de la caja vs período anterior (8 = +8%). */
  "cash_delta_pct": 8,
}
```

## Semántica

- **`key_obligations[]`** — las 3 obligaciones que "no perdonan" a una PYME chilena.
  Es nuestro foso vs. Xero (ellos no saben de F29 ni Previred).
  - `key` ∈ `imposiciones | impuestos_mensuales | sueldos` (estable; permite íconos/orden).
  - `label`: texto legible. Nomenclatura acordada con Fernando: **"Impuestos Mensuales (F29)"** (no "IVA/F29").
  - `due_date`: ISO date; el FE formatea a fecha chilena.
  - `amount`: string-decimal.
  - `coverage` ∈ `covered | tight | uncovered` — estado contra la caja proyectada a esa
    fecha. Es **lógica de negocio del backend** (el FE NO la calcula): ✓ cubierto /
    ⚠ ajustado / ✗ no alcanza.
- **`cash_sparkline`** — serie corta de saldos de caja para la mini-tendencia. Vacío/null
  si no hay historia.
- **`cash_delta_pct`** — % de variación de `cash_today` vs. el período anterior.

## Notas

- **Todos opcionales**: si el backend aún no los manda, el v2 oculta esas secciones
  (no rompe). El v1 (`/inicio`) los ignora.
- **Aceptar cookie de sesión** (sin `security: APIKeyHeader`) — igual que el resto del
  endpoint (ya destrabado).
- El **runway como fecha** ("te alcanza hasta el 18 de julio") lo deriva el FE de
  `cash_forecast.days_of_cash` (presentación). Si el backend prefiere mandar la fecha
  exacta (calendario, no días naturales), agregar `cash_forecast.runway_date` y el FE
  la usa directo.
- Contrato base del endpoint: `docs/backend-contracts/inicio-dashboard-summary-contract.md`.
