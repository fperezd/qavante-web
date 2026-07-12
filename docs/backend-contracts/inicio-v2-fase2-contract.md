# Contrato esperado — Inicio Ejecutivo v2, Fase 2 (motor de comportamiento de pago + prefs)

> **CC-WEB → CC-API. 2026-07-12.** Contrato **FE-first**: el FE ya construyó los
> componentes presentacionales del rediseño aprobado del Inicio Ejecutivo (grupo
> "Inicio v2" en Storybook, PRs #515/#517), gated por `inicioEjecutivoV2` (OFF).
> **CC-WEB provee el shape** (los componentes ya dictan lo que necesitan → evita
> rework). CC-API buildea a esto; **cualquier ajuste que necesiten por restricción
> de dato, avisen y el FE adapta.** Montos **string-decimal** (convención treasury).
> Auth **cookie `qavante_session`** (`require_api_key_or_session`), sin
> `security: APIKeyHeader`.
>
> Son **3 endpoints buildables ya**. El 4º (serie `trend_30d` del Pulso) va con el
> flip PULSO v2 (#565) porque necesita los snapshots `q_score_*` — no va acá.

---

## 1. `GET /api/treasury/collection-forecast?horizon_days=14`

Alimenta la card **CobranzaRealizable** y la **acción 1 del Plan de cierre de brecha**
("Cobrar a clientes que pagan a tiempo"). Estima cuánta cobranza **entra a tiempo**
dentro del horizonte, segmentada por probabilidad **derivada del comportamiento de
pago histórico** (de la conciliación banco↔factura). NO de compromisos cargados a
mano ni de CRM.

- **Query:** `horizon_days` (int, default 14).
- **200 →** `CollectionForecastResponse`:

```jsonc
{
  "horizon_days": 14,
  "expected_on_time": "7800000",   // realizable con alta prob. dentro del horizonte (= banda "high")
  "due_in_horizon": "18200000",    // total que vence en el horizonte (por fecha)
  "total_receivable": "205400000", // total por cobrar (dato secundario en la card)
  "overdue": "0",                  // vencido (0 = al día → verde en el FE)
  "segments": [                    // el FE pone los labels; el back da band + amount
    { "band": "high",     "amount": "7800000" },  // pagan a tiempo (comportamiento estable)
    { "band": "probable", "amount": "4300000" },  // pago irregular
    { "band": "unknown",  "amount": "6100000" }   // sin patrón de pago claro
  ],
  "confidence": "high",            // high|medium|low
  "data_state": "available",       // available|partial|estimated (igual que AR/AP)
  "missing_sources": [],           // fuentes faltantes (ej. "Conciliación insuficiente")
  "generated_at": "2026-07-12T18:00:00Z"
}
```

- `band` ∈ `high|probable|unknown`. Suma de `segments` = `due_in_horizon`.
- Con poco historial de conciliación → `data_state:"partial"` + `missing_sources`, y
  el FE muestra el total/aging sin los segmentos (degradación honesta, no inventa).

---

## 2. `GET /api/treasury/cash-cycle`

Alimenta el hallazgo del **lente Control de gestión** ("El ciclo de caja se alargó a
N días — capital de trabajo inmovilizado $X"). Sale de la conciliación (tiempos reales
de cobro/pago).

- **200 →** `CashCycleResponse`:

```jsonc
{
  "dso_days": 42,                       // días promedio de cobro (nullable si no calculable)
  "dpo_days": 28,                       // días promedio de pago (nullable)
  "working_capital_gap_clp": "4100000", // capital de trabajo inmovilizado por el desfase (nullable)
  "confidence": "medium",
  "generated_at": "2026-07-12T18:00:00Z"
}
```

- Si `working_capital_gap_clp` es caro de calcular, mándenlo `null`: con
  `dso_days`/`dpo_days` el FE lo aproxima (ventas/día × (dso − dpo)).

---

## 3. `GET` / `PUT` `/api/me/preferences`

Persiste preferencias del usuario **por-tenant o por-usuario** (a criterio de CC-API).
Hoy: el orden de las tarjetas movibles del Inicio. **No puedo usar `localStorage`**
(restricción del FE), por eso pido un endpoint. Blob genérico para futuras prefs.

- **`GET /api/me/preferences` → 200:**

```jsonc
{
  "preferences": {
    "inicio_widget_order": ["caja", "cobranza", "pagos", "resultado"]  // opcional; ausente = orden por defecto
  }
}
```

- **`PUT /api/me/preferences`** body (merge parcial, no reemplazo total):

```jsonc
{ "inicio_widget_order": ["resultado", "caja", "cobranza", "pagos"] }
```

  → **200** con el `preferences` resultante (mismo shape que el GET).
- Claves desconocidas: guardar sin validar (blob libre) o ignorar — el FE tolera
  ausencia. IDs válidos de widget hoy: `caja` · `cobranza` · `pagos` · `resultado`.

---

## Notas de integración (FE)

- Los 3 son **opcionales para la página**: el Inicio v2 se activa (flag) cableado a
  los contratos que YA existen (`cash_forecast`, `cash_gap`, `operational_result`,
  `payables`, `bank-movements`, Pulso). Estos 3 **encienden** piezas que hasta
  entonces se degradan con honestidad (Cobranza sin segmentos, Control sin ciclo de
  caja, layout sin persistencia).
- Cuando estén en el snapshot, corro `generate:api` y cableo. Tipos hand-rolled
  mientras tanto en `src/lib/api/` (siguiendo el shape de arriba).
- El **Plan de cierre de brecha** NO necesita endpoint nuevo: lo compone el FE con
  `collection-forecast` (acción cobrar) + `payables` negociables (acción reprogramar)
  + un placeholder de línea/factoring (acción "por evaluar").
