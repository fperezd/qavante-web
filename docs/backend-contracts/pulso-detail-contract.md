# Contrato esperado — Pulso detalle (Sprint C6/C7)

> ⚠️ **Metodología actualizada 2026-07-05 (decisión de Fernando):** la
> composición del Pulso está definida en
> [`docs/scoring/pulso-y-health-score-spec-v1.md`](../scoring/pulso-y-health-score-spec-v1.md)
> — componentes **COB / RUN / DPC / CAL** con fórmula
> `0.40·COB + 0.25·RUN + 0.20·DPC + 0.15·CAL`. Los ejes de ejemplo de este
> contrato (liquidez/cobranza/rentabilidad) eran placeholders FE-first y quedan
> **obsoletos** — CC-API debe implementar el motor según la spec. El *shape* de
> respuesta y los 4 `status` de este contrato siguen vigentes (las 5 bandas
> metodológicas se colapsan a los 4 estados según §2.7 de la spec).

> ✅ **Verificado 2026-06-21 (CC-WEB):** shape vigente, idéntico a los types del FE (`src/lib/api/pulso.ts`). `status` ∈ critical|weak|stable|strong. **Pedido:** `trend[].period` en formato `"YYYY-MM"` (el FE lo muestra como mes-año). Construir contra esto — flip inmediato al exponerse.

> **CC-WEB → CC-API. 2026-06-03.** Contrato **FE-first**: el FE construyó la
> pantalla `/gestion/pulso` ("¿por qué está así mi Pulso?", Maestro §7, Anexo C)
> contra este contrato + MSW, **gated por `pulsoDetail` (OFF en prod)**. El
> endpoint **aún no existe**. Es el detalle del Pulso que el dashboard
> (`/api/dashboard/summary`) muestra resumido. Cuando CC-API lo exponga, corro
> `generate:api`, ajusto el adapter y activo el flag. Tipos hand-rolled en
> `src/lib/api/pulso.ts`.

## Endpoint

`GET /api/management/pulso`

- **Auth:** cookie `qavante_session` (sin `security` declarado, como `/api/me`).
- **200** → `PulsoDetailResponse`. **Cada sección puede venir vacía** (`components`,
  `drivers`, `trend` = `[]`; `headline` = `null`) si aún no hay cálculo: el FE
  muestra un empty-state de onboarding sin tumbar nada.

## Semántica (Maestro §7, Anexo C)

- **El cálculo es lógica de negocio del BACKEND** (score, pesos, drivers, knock-outs).
  El FE **solo muestra** — no calcula nada (CLAUDE.md). `headline` es rule-based (NO LLM).
- `score` 0–100; `status` ∈ `critical | weak | stable | strong` (knock-outs fuerzan `critical`).
- `components[]`: los ejes del índice — **COB, RUN, DPC, CAL** según la spec de
  scoring (los ejemplos liquidez/rentabilidad/cobranza de abajo son previos a la
  spec y no deben implementarse) — cada uno con su sub-score 0–100 y su `weight`
  0–1 (peso en el total).
- `drivers[]`: factores que empujan el Pulso, con `direction` (+/−), `impact`
  (high/medium/low), explicación y CTA opcional a una ruta interna del FE.
- `trend[]`: histórico del score por período (más reciente último).

## Response shape

```jsonc
{
  "score": 68,
  "status": "stable",
  "confidence": "medium",
  "preliminary": false,
  "headline": "Tu Pulso está estable: la rentabilidad ayuda, pero la cobranza más lenta lo frena.",
  "components": [
    { "key": "liquidity", "label": "Liquidez", "score": 72, "weight": 0.3 },
    { "key": "collections", "label": "Cobranza", "score": 48, "weight": 0.25 },
  ],
  "drivers": [
    {
      "label": "Margen en alza",
      "direction": "positive",
      "impact": "high",
      "detail": "El margen bruto subió 4 pts vs. el mes anterior.",
      "cta_label": "Ver resultado",
      "cta_href": "/gestion",
    },
    {
      "label": "Cobranza lenta",
      "direction": "negative",
      "impact": "high",
      "detail": "Hay $7,9M vencidos; el plazo promedio de cobro subió a 52 días.",
      "cta_label": "Ver cobranza",
      "cta_href": "/cobrar",
    },
  ],
  "trend": [
    { "period": "abr", "score": 66 },
    { "period": "may", "score": 68 },
  ],
  "generated_at": "2026-06-03T12:00:00Z",
}
```

## Notas para CC-API

- Secciones vacías permitidas (`[]` / `null`) — el FE NO asume nada; muestra
  onboarding si todo viene vacío.
- `drivers[].cta_href`: ruta interna del FE (`/cobrar`, `/pagar`, `/gestion`,
  `/caja/proyeccion`, `/caja/por-clasificar`).
- `components[].weight` suma idealmente 1 (el FE muestra `peso NN%`).
- **Aceptar cookie de sesión** (sin `security: APIKeyHeader`) — si no, el FE no
  puede activarlo (Brecha 0, mismo patrón que el resto de gestión).
- Reutiliza el mismo Pulso que `/api/dashboard/summary.pulso` — esto es su detalle.
- Endpoint para el flag (FLAG_GATING_ENDPOINT): `/api/management/pulso`.
