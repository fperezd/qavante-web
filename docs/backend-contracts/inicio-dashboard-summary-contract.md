# Contrato esperado — Inicio Ejecutivo / Dashboard summary (Sprint C8)

> **CC-WEB → CC-API. 2026-06-02 (act. 2026-06-03).** Contrato **FE-first**: el FE
> construyó el Inicio Ejecutivo (`/inicio`, Maestro §7.1) contra este contrato +
> MSW, **gated por `dashboardSummary` (OFF en prod)**. **El endpoint YA existe en
> el OpenAPI de prod (2026-06-03) y su shape coincide exacto con este contrato**,
> pero está gated por API key (no cookie) → no activable aún (ver Estado de
> coordinación). Tipos hand-rolled en `src/lib/api/dashboard.ts` (pendiente
> `generate:api` cuando se destrabe la cookie). Es el agregador central del producto.

## Endpoint

`GET /api/dashboard/summary`

- **Auth:** cookie `qavante_session`.
- **200** → `DashboardSummaryResponse`. **Cada bloque es nullable**: una fuente
  que falte/falle → ese bloque `null` (el FE muestra "sin dato" en esa card sin
  tumbar el resto — Maestro §7.1 "carga aunque una fuente falle", §13 faltante ≠ 0).
- Performance (Maestro I.8.3): primera respuesta <500ms; ideal cargar por bloques.

## Semántica (Maestro §7.1)

- **Frase ejecutiva `executive_phrase` rule-based, NO LLM** (Anexo H.1).
- **Pulso**: score 0–100, estado (critical/weak/stable/strong), confianza,
  driver+/driver−, `preliminary` si incompleto. Knock-outs fuerzan `critical`.
- Montos string-decimal. CLP + fechas chilenas las formatea el FE.

## Response shape

```jsonc
{
  "executive_phrase": "Tu caja alcanza ~6 semanas; hay $7,9M vencidos por cobrar.",
  "pulso": {
    "score": 68,
    "status": "stable",
    "confidence": "medium",
    "top_driver_positive": "Ventas en alza",
    "top_driver_negative": "Cobranza lenta",
    "preliminary": false,
  },
  "cash_today": {
    "total": "9800000",
    "last_updated": "2026-06-02T08:00:00Z",
    "data_state": "available",
  },
  "cash_forecast": { "min_14d": "5400000", "min_30d": "2100000", "days_of_cash": 42 },
  "cash_gap": {
    "critical_obligations_14d": "6600000",
    "projected_cash_14d": "5400000",
    "has_gap": true,
  },
  "overdue_collections": {
    "total_receivable": "24800000",
    "overdue": "7900000",
    "top_clients": [{ "name": "Constructora Andes SpA", "amount": "3200000" }],
  },
  "critical_payments": {
    "due_7d": "3800000",
    "due_14d": "6200000",
    "next_critical": { "label": "IVA / F29 mayo", "due_date": "2026-06-12", "amount": "2400000" },
  },
  "operational_result": {
    "revenue": "18500000",
    "gross_margin": "11100000",
    "ebitda_proxy": "3900000",
    "result": "3900000",
  },
  "priority_actions": [
    {
      "priority": 1,
      "reason": "Cobra $3,2M vencidos a Constructora Andes",
      "deadline": "esta semana",
      "cta_label": "Ver cobranza",
      "cta_href": "/cobrar",
    },
  ],
  "generated_at": "2026-06-02T12:00:00Z",
}
```

## Entrega incremental (acordado con CC-API 2026-06-02)

El FE soporta entrega por bloques: arranca con lo que ya tiene motor y deja el
resto `null`. **`executive_phrase` y `priority_actions` también son nullable** y
el FE los maneja (frase ausente → no se renderiza; acciones `null`/`[]` → no se
renderiza el bloque "Qué hacer primero"). Primer drop esperado: `cash_today` +
`cash_forecast` + `cash_gap` con dato real, todo lo demás `null`.

- `executive_phrase`: `string | null` (null hasta que exista el motor rule-based).
- `priority_actions`: `DashboardAction[]` o `null` (= Brecha 2, heurístico-vs-LLM).
- `pulso`, `operational_result`, `overdue_collections`, `critical_payments`:
  `null` hasta tener su cálculo.

## Notas para CC-API

- Cualquier bloque puede ser `null` (fuente faltante) — el FE NO asume 0.
- `priority_actions`: **máximo 3**, `cta_href` ruta interna del FE (`/cobrar`,
  `/pagar`, `/caja/proyeccion`, `/gestion`, `/caja/por-clasificar`).
- `pulso.status` ∈ critical | weak | stable | strong; `score` 0–100.
- `cash_today.data_state` ∈ available | stale | estimated (frescura del saldo).
- Este endpoint **reutiliza** los cálculos de operational-result / accounts-
  receivable / accounts-payable / cash-flow — es su agregación para el home.
- Endpoint para el flag (FLAG_GATING_ENDPOINT): `/api/dashboard/summary`.

## Estado de coordinación

| Fecha      | Quién  | Hito                                                                                                                                                                                               |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-02 | CC-WEB | Handoff inicial: `/inicio` construido contra este contrato + MSW, gated por `dashboardSummary` (OFF en prod) — PR #286.                                                                            |
| 2026-06-02 | CC-API | Confirma construirlo; **entrega incremental** (caja primero, resto `null`). `executive_phrase` y `priority_actions` arrancan `null`. Arranca **después de ADR-0032** (credenciales SII).           |
| 2026-06-02 | CC-WEB | Alinea el contrato a la entrega incremental: `executive_phrase` y `priority_actions` ahora nullable, FE no crashea con el primer drop — PR #287.                                                   |
| 2026-06-03 | CC-API | **Expone `GET /api/dashboard/summary`** en el OpenAPI de prod. Shape **coincide exacto** con el contrato FE-first (los 10 bloques, `executive_phrase`/`priority_actions` nullable, montos string). |
| 2026-06-03 | CC-WEB | Verifica en OpenAPI: shape ✅, pero `security: APIKeyHeader` → **el endpoint NO acepta cookie** (Brecha 0). El FE no puede activarlo; flag sigue OFF hasta que se acepte cookie de sesión.         |

> ⚠️ **Blocker de activación (Brecha 0):** `/api/dashboard/summary` declara
> `security: [{ APIKeyHeader: [] }]`. El FE autentica por cookie `qavante_session`
> y **nunca** envía API keys desde el browser. Hasta que CC-API lo deje sin
> `security` declarado (acepta cookie, como `/api/me` y los 12 endpoints de la
> Brecha 0 ya destrabados), el flag `dashboardSummary` no se puede activar en prod
> aunque el endpoint exista y el shape sea correcto. Mismo patrón que dimensiones/SII.

**Pendientes (owner CC-API):** ADR de diseño de `pulso` (fórmula score, knock-outs,
umbrales de status), `executive_phrase` (reglas rule-based, Anexo H.1) y
`priority_actions` (= Brecha 2, decisión heurístico-vs-LLM). Es lógica de negocio
del backend; el FE solo mapea `status`→label y formatea CLP/fechas.

**Cuando el endpoint exista (aunque sea solo `cash_*`):** CC-WEB corre
`generate:api`, reemplaza los tipos hand-rolled, ajusta el adapter y activa el
flag para ese primer drop.
