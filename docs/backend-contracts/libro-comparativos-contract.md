# Contrato esperado — Comparativos del Libro (Ventas / Compras)

> **CC-WEB → CC-API. 2026-07-13.** Contrato **FE-first** del rediseño aprobado del
> **Libro de Ventas** (grupo "Propuestas / Libro de Ventas" en Storybook, PRs #533
> `VentasHero` + #534 lógica pura `calcularComparativos`). El hero pone arriba la
> **respuesta de dueño** — "La empresa vendió $X" (neto) — con **tres comparativos
> del ritmo** + un **sparkline mes a mes**.
>
> **Decisión de Fernando (2026-07-13):** el FE calcula estos comparativos **ahora**
> con consultas extra al SII (varios meses), y **en paralelo pide este endpoint** para
> que CC-API los devuelva **ya calculados y rápidos** (sin que el FE baje 12–24 meses
> por request). CC-WEB provee el shape; **cualquier ajuste por restricción de dato,
> avisen y el FE adapta.** Montos **string-decimal**. Auth **cookie `qavante_session`**
> (`require_api_key_or_session`), sin `security: APIKeyHeader`.

---

## Por qué un endpoint (y no seguir con consultas del FE)

Hoy el Libro baja el rango elegido **mes por mes** (`GET /api/sii/rcv/ventas?periodo=YYYY-MM`,
una query por mes). Los tres comparativos necesitan datos **fuera del rango**:

| Comparativo | Dato que necesita |
|---|---|
| Este mes vs. **misma fecha** del mes anterior | mes en curso + mes anterior, filtrado por día |
| Mes anterior vs. **promedio mensual del año** | los meses del año en curso |
| vs. **año anterior** (YoY) | el mismo período, del año anterior |

Calcularlos en el FE implica **N consultas extra al SII** por apertura del libro (lento
y frágil: si un mes falla, el comparativo se degrada). Un endpoint que los devuelva
pre-agregados los hace instantáneos y robustos. La **lógica ya está** en el FE
(`src/components/sii/libro-v2/libro-comparativos.ts`) — este endpoint la reemplaza por
un cálculo backend equivalente.

---

## `GET /api/sii/rcv/{kind}/comparativos?desde=YYYY-MM&hasta=YYYY-MM`

- **`kind`** (path): `ventas` | `compras`.
- **Query:** `desde`, `hasta` (`YYYY-MM`, inclusive) = el rango que el usuario tiene
  seleccionado en el libro. `hasta` define también cuál es "el mes en curso" / "mes
  anterior" para los comparativos 1 y 2.
- **Neteo de NC:** todos los `neto` vienen **con notas de crédito ya descontadas**
  (mismo criterio que el F29 / `computeRcvTotals`, Opción A 2026-07-03).

**200 → `LibroComparativosResponse`:**

```jsonc
{
  // Neto del rango seleccionado (para el número de oro del hero).
  "neto_periodo": "126376400",

  // Serie para el sparkline "mes a mes": un punto por mes del rango, cronológico.
  "serie_mensual": [
    { "periodo": "2026-02", "neto": "18200000" },
    { "periodo": "2026-03", "neto": "21500000" },
    { "periodo": "2026-07", "neto": "23400000" }
  ],

  // (1) Este mes vs. misma fecha del mes anterior. null si no calculable
  //     (mes en curso sin ventas aún, o base 0). `pct` puede ser negativo.
  "mismo_dia_mes_anterior": {
    "pct": 8.0,
    "dia_corte": 12,                 // día del mes hasta el que se compara (hoy)
    "neto_actual": "9100000",        // neto del mes en curso hasta dia_corte
    "neto_base": "8420000"           // neto del mes anterior hasta dia_corte
  },

  // (2) El mes anterior cerrado vs. el promedio mensual del año en curso. null si
  //     no hay meses suficientes.
  "mes_vs_promedio_anual": {
    "pct": 12.0,
    "mes_label": "julio",            // etiqueta legible del mes anterior
    "neto_mes": "23400000",
    "promedio_anual": "20892000"     // promedio de los meses del año en curso
  },

  // (3) vs. el mismo período del año anterior (YoY). null si no hay dato del año
  //     anterior o base 0.
  "yoy": {
    "pct": 15.0,
    "neto_periodo": "126376400",
    "neto_anio_anterior": "109892000"
  },

  // Capa de confianza (igual que RcvVentasResponse).
  "last_synced_at": "2026-07-13T09:00:00Z",  // ISO UTC, o null
  "stale": false                              // true = cache por fallo transitorio del SII
}
```

### Mapeo directo al FE (para minimizar rework)

Cada bloque calza 1:1 con lo que ya consume `VentasHero` vía `calcularComparativos`:

- `neto_periodo` → número de oro.
- `serie_mensual[].neto` → `serie` del sparkline (orden cronológico, más reciente último).
- `mismo_dia_mes_anterior.pct` → comparativo *"este mes vs. misma fecha del mes anterior"*.
- `mes_vs_promedio_anual.pct` + `mes_label` → *"{mes} sobre el promedio mensual del año"*.
- `yoy.pct` → *"vs. el mismo período del año anterior"*.
- Cualquier bloque `null` → el FE **omite** ese comparativo (degradado honesto, ya implementado).
- El **signo** de cada `pct` decide color/flecha en el FE (↗ verde / ↘ rojo). Mandar el
  `pct` **con signo** (positivo sube, negativo baja); no mandar valor absoluto.

### Notas

- **Redondeo del `pct`:** el FE redondea a entero para mostrar; pueden mandar decimales.
- **`kind=compras`:** mismo shape; el FE cambia el copy ("la empresa compró", "IVA
  crédito", "proveedores"). El endpoint solo cambia la fuente (RCV compras).
- **Mientras no exista:** el FE calcula lo que puede con consultas extra y **degrada**
  los comparativos que no pueda (no inventa). Con el endpoint, todos salen rápidos.

— CC-WEB
