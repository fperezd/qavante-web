# Contrato esperado — Pantalla Salud (PULSO + Health Score, ADR-0064)

> **CC-WEB → CC-API. 2026-07-07.** Contrato **FE-first**: el FE ya tiene la pantalla
> `/gestion/salud` (los dos instrumentos + matriz + drivers + decisiones +
> confianza), gated por `saludScreen` (OFF en prod, patrón como `/gestion/pulso`),
> consumiendo **datos de ejemplo**. El motor real es el v2 del backend (qavante-api
> ADR-0064, issues #492 PULSO / #495 QHS / #493 flip; snapshots #488 ya está). El
> cableado a datos reales es qavante-web **#487**.
>
> **Este doc pin­ea los NOMBRES DE CAMPO EXACTOS que el FE ya espera** (tipos en
> `src/components/gestion/salud/salud-model.ts`) — si CC-API emite estas keys, el
> `generate:api` calza 1:1 y el flip es inmediato, sin adapter. Si prefieren otras
> keys, sirve igual pero avisen (el FE agrega un adapter chico).

## Endpoint (preferencia del FE)

`GET /api/management/salud`

- **Auth:** cookie `qavante_session` (sin `security` declarado, como `/api/me`).
- **200** → el objeto de abajo (ambos instrumentos + matriz + drivers + decisiones
  - confianza **en una sola llamada**). Preferimos un endpoint agregado para que el
    FE no orqueste dos requests ni arme la matriz. Si CC-API prefiere dos endpoints
    separados (pulso v2 + qhs), también sirve — avisen para ajustar el data layer.
- **Cada sección puede venir vacía / null** si aún no hay cálculo: el FE muestra
  onboarding sin tumbar nada.

## Semántica (Maestro §7-§8, ADR-0064)

- **El cálculo es lógica de negocio del BACKEND** (scores, pesos, bandas, drivers,
  knock-outs, veredictos). El FE **solo muestra** (CLAUDE.md §17.4).
- **Textos en lenguaje de dueño (§8 "Diccionario de UI" de
  [`docs/scoring/pulso-y-health-score-spec-v1.md`](../scoring/pulso-y-health-score-spec-v1.md)):**
  `headline`, `drivers[].title/detail/impact/cta`, `decisions[].*`, `deltaLabel`,
  `reading`, `note` vienen **ya en pesos y frases**, sin reason codes ni ratios
  crudos. El FE NO re-traduce. Los **reason codes técnicos van en un campo aparte**
  (para logs/auditoría), no en el texto visible.
- Montos de caja (`cash[].amount`, `cashMin`) en **millones de CLP**.

## Response shape (keys exactas)

```jsonc
{
  "tenantName": "Tooxs Digital SpA",
  "asOf": "2026-07-31", // fecha/mes del cálculo

  "pulso": {
    "score": 42, // 0–100
    "band": "ajustado", // "holgado" | "estable" | "ajustado" | "tenso" | "critico"
    "components": [
      // ejes del Pulso (COB/RUN/DPC/CAL, spec)
      { "label": "Cobranza", "value": 55, "weight": 0.4 }, // value 0–100, weight 0–1
    ],
    "cash": [
      // proyección DIARIA de caja, 30 días
      { "day": 0, "amount": 12.5 }, // day 0–30, amount en MILLONES de CLP
    ],
    "cashMin": 5.0, // umbral "mínimo seguro", en millones
    "breachDay": 12, // día (0–30) en que la caja cruza el mínimo; null si no cruza
    "recoveryDay": 20, // día de recuperación con el cobro esperado; null si no aplica
    "knockoutsActive": false, // ¿knock-outs activos? (fuerzan banda crítica)
  },

  "qhs": {
    "score": 68, // 0–100
    "band": "observacion", // "muy_sana" | "sana_alertas" | "observacion" | "vulnerable" | "riesgo_alto"
    "deltaLabel": "+3 vs. junio", // variación vs. mes anterior, YA en texto de dueño
    "components": [{ "label": "Rentabilidad", "value": 70, "weight": 0.3 }],
    "closingLabel": "Cierre de junio 2026", // período de cierre
    "nextLabel": "Próximo cierre: 31 jul", // siguiente cierre
  },

  "confidence": {
    "score": 82, // 0–100 (calidad del dato)
    "factors": [
      { "label": "Meses de historia", "value": 90 }, // value 0–100
    ],
    "note": "Basado en 8 meses de datos sincronizados.",
  },

  "matrix": {
    "active": "apreton", // "apreton" | "crecer" | "crisis" | "desangra" (cuadrante PULSO×QHS)
    "reading": "Aprieta la caja hoy, pero la empresa viene sana.", // lectura en 1 frase
  },

  "trend": [
    // serie MENSUAL del QHS (de los snapshots q_score_*)
    { "month": "2026-01", "value": 60 }, // month "YYYY-MM", value 0–100
  ],

  "drivers": [
    // §8: lenguaje de dueño; el reason code técnico va aparte, no acá
    {
      "category": "Impuestos", // "Impuestos" | "Cobranza" | "Gastos" | "Deuda" | "Concentración" | "Caja"
      "tone": "bad", // "bad" | "warn" | "ok"
      "icon": "tax", // "tax" | "clock" | "trend" | "shield" | "coins"
      "title": "El F29 de julio te aprieta",
      "detail": "Vence el 20 y son $2.480.000.",
      "impact": "Baja tu Pulso 8 puntos.",
      "cta": "Ver F29",
    },
  ],

  "decisions": [
    {
      "icon": "person", // "person" | "bank" | "box" | "coins"
      "title": "¿Puedo pagar sueldos?",
      "verdict": "margen_justo", // "si" | "margen_justo" | "todavia_no" | "no_por_ahora"
      "verdictLabel": "Con margen justo",
      "rule": "Alcanza, pero quedás bajo el mínimo 3 días.",
    },
  ],
}
```

## Notas de mapping

- `breachDay`/`recoveryDay` son **índices de día** dentro de la proyección `cash[]`
  (0 = hoy), no fechas — el FE los usa para marcar el sparkline. `null` = no aplica.
- `band` (pulso) tiene **5 bandas** metodológicas; el semáforo colapsa a estados de
  color en el FE. `qhs.band` idem (5 bandas de salud estructural).
- `components[]` de pulso y qhs comparten shape `{ label, value, weight }`.
- `trend[].month` en `"YYYY-MM"` (el FE lo muestra como mes-año).

Construir contra esto → **flip inmediato al exponerse** (`generate:api` + activar
`saludScreen`). Dudas del contrato, en el issue #487 o en `STATE_OF_THE_TRAIN.md`.
