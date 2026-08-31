import { describe, expect, it } from "vitest";
import type { BudgetLine, BudgetVsActualResponse } from "@/lib/api/planning";
import {
  concordar,
  csvDesviosV09,
  desviosV09,
  estadoDatosV09,
  periodoDefaultV09,
  resultRealCoincideConResultado,
  revenueRealCoincideConResultado,
  triadaV09,
} from "./presupuesto-v09-model";

/* Fixture con la forma REAL del contrato verificado contra producción (issue #74, comentario
 * 2026-08-31): 4 líneas (revenue/direct_cost/operating_expense/result), `variance`/`variance_pct`
 * YA CALCULADOS por el backend — este módulo nunca los recalcula. Montos inventados, sin relación
 * con ningún tenant real. */
function linea(over: Partial<BudgetLine> & Pick<BudgetLine, "concept">): BudgetLine {
  return {
    budget: "0",
    actual: "0",
    variance: "0",
    variance_pct: "0",
    ...over,
  };
}

const LINEAS_NORMALES: BudgetLine[] = [
  linea({
    concept: "revenue",
    budget: "30000000",
    actual: "32500000",
    variance: "2500000",
    variance_pct: "8.3",
  }),
  linea({
    concept: "direct_cost",
    budget: "-12000000",
    actual: "-13400000",
    variance: "-1400000",
    variance_pct: "-11.7",
  }),
  linea({
    concept: "operating_expense",
    budget: "-9000000",
    actual: "-8200000",
    variance: "800000",
    variance_pct: "8.9",
  }),
  linea({
    concept: "result",
    budget: "9000000",
    actual: "10900000",
    variance: "1900000",
    variance_pct: "21.1",
  }),
];

function bva(over: Partial<BudgetVsActualResponse> = {}): BudgetVsActualResponse {
  return {
    period: "2026-07",
    lines: LINEAS_NORMALES,
    has_budget: true,
    data_state: "available",
    missing_sources: [],
    generated_at: "2026-08-01T12:00:00Z",
    ...over,
  };
}

describe("periodoDefaultV09 — el último mes cerrado", () => {
  it("agosto en curso → julio", () => {
    expect(periodoDefaultV09(new Date("2026-08-30T15:00:00Z"))).toBe("2026-07");
  });
  it("enero en curso → diciembre del año anterior", () => {
    expect(periodoDefaultV09(new Date("2026-01-15T15:00:00Z"))).toBe("2025-12");
  });
});

describe("estadoDatosV09 — el bucket 'no sé' (Ley 3)", () => {
  it("sin_presupuesto cuando has_budget es falso", () => {
    expect(
      estadoDatosV09({ has_budget: false, data_state: "available", missing_sources: [] }),
    ).toBe("sin_presupuesto");
  });

  it("incompleto cuando data_state no es 'available'", () => {
    expect(estadoDatosV09({ has_budget: true, data_state: "partial", missing_sources: [] })).toBe(
      "incompleto",
    );
  });

  it("incompleto cuando missing_sources trae algo, aunque data_state sea 'available'", () => {
    expect(
      estadoDatosV09({ has_budget: true, data_state: "available", missing_sources: ["sii"] }),
    ).toBe("incompleto");
  });

  /* [control positivo] con el mismo shape de "incompleto" pero limpio, el resultado NO es
   * incompleto — la MISMA condición que arriba, invertida, prueba que el chequeo distingue de
   * verdad y no siempre devuelve el mismo bucket. */
  it("[control positivo] completo cuando has_budget=true, data_state='available' y sin missing_sources", () => {
    expect(estadoDatosV09({ has_budget: true, data_state: "available", missing_sources: [] })).toBe(
      "completo",
    );
  });

  it("completo también cuando missing_sources no viene (undefined, no [])", () => {
    expect(
      estadoDatosV09({ has_budget: true, data_state: "available", missing_sources: undefined }),
    ).toBe("completo");
  });
});

describe("triadaV09 — sin presupuesto (Ley 3, nunca un plan inventado)", () => {
  it("null cuando has_budget es falso", () => {
    expect(triadaV09("julio", bva({ has_budget: false }))).toBeNull();
  });

  it("null cuando no viene la línea 'result' (contrato roto)", () => {
    expect(
      triadaV09("julio", bva({ lines: LINEAS_NORMALES.filter((l) => l.concept !== "result") })),
    ).toBeNull();
  });

  /* Mutante nulo de control: con datos normales la tríada NO puede ser null. Si este test muere,
   * los dos de arriba no prueban nada real (podrían estar devolviendo null siempre). */
  it("[control] NO es null con presupuesto normal y la línea result presente", () => {
    expect(triadaV09("julio", bva())).not.toBeNull();
  });
});

describe("triadaV09 — Plan/Real/Desvío SIN recalcular (Ley 1)", () => {
  it("plan = budget de la línea result, tal cual", () => {
    expect(triadaV09("julio", bva())?.plan).toBe(9_000_000);
  });

  it("real = actual de la línea result, tal cual", () => {
    expect(triadaV09("julio", bva())?.real).toBe(10_900_000);
  });

  it("desvio = variance de la línea result — NO real menos plan recalculado", () => {
    const t = triadaV09("julio", bva())?.desvio;
    expect(t).toBe(1_900_000);
    // Coincide con real-plan en este fixture (9M+1.9M=10.9M), pero la fuente es `variance`:
    // el siguiente test (backend discrepante) prueba que NO se recalcula.
  });

  it("desvioPct = variance_pct de la línea result, tal cual (sin redondear distinto)", () => {
    expect(triadaV09("julio", bva())?.desvioPct).toBe(21.1);
  });

  /* Mutante: si alguien "simplifica" a `real - plan` en vez de leer `variance`, este test debe
   * caer. Fixture con `variance` DELIBERADAMENTE distinto de `actual - budget` (backend
   * discrepante o redondeo propio del motor) — el modelo tiene que devolver el campo del backend
   * tal cual, no la resta. */
  it("desvio viene de `variance` aunque no calce con actual−budget (nunca se recalcula)", () => {
    const discrepante = bva({
      lines: LINEAS_NORMALES.map((l) =>
        l.concept === "result" ? { ...l, variance: "1234567" } : l,
      ),
    });
    expect(triadaV09("julio", discrepante)?.desvio).toBe(1_234_567);
    expect(triadaV09("julio", discrepante)?.desvio).not.toBe(1_900_000); // = actual - budget
  });

  it("favorable = true cuando desvio >= 0", () => {
    expect(triadaV09("julio", bva())?.favorable).toBe(true);
  });

  it("[control positivo] favorable = false cuando desvio < 0", () => {
    const enContra = bva({
      lines: LINEAS_NORMALES.map((l) =>
        l.concept === "result" ? { ...l, variance: "-500000" } : l,
      ),
    });
    expect(triadaV09("julio", enContra)?.favorable).toBe(false);
  });
});

describe("desviosV09 — tabla de desvíos por concepto", () => {
  it("trae 3 líneas (revenue/direct_cost/operating_expense), sin 'result'", () => {
    const filas = desviosV09(bva());
    expect(filas).toHaveLength(3);
    // El TIPO de `DesvioLineaV09.concepto` ya excluye "result" (no compila comparar contra él);
    // el runtime lo confirma por las etiquetas, que sí incluyen las 3 esperadas y ninguna más.
    expect(filas.map((f) => f.label).sort()).toEqual(
      ["Costo directo", "Gastos operacionales", "Ingresos"].sort(),
    );
  });

  it("[control positivo] con las 3 líneas presentes, 'result' SÍ está ausente pero las otras SÍ están", () => {
    const conceptos = desviosV09(bva()).map((f) => f.concepto);
    expect(conceptos).toContain("revenue");
    expect(conceptos).toContain("direct_cost");
    expect(conceptos).toContain("operating_expense");
  });

  it("[] cuando no hay presupuesto", () => {
    expect(desviosV09(bva({ has_budget: false }))).toEqual([]);
  });

  it("omite líneas sin desvío (variance = 0)", () => {
    const sinDesvioEnGastos = bva({
      lines: LINEAS_NORMALES.map((l) =>
        l.concept === "operating_expense" ? { ...l, variance: "0" } : l,
      ),
    });
    const filas = desviosV09(sinDesvioEnGastos);
    expect(filas.some((f) => f.concepto === "operating_expense")).toBe(false);
    expect(filas).toHaveLength(2);
  });

  it("ordena peor primero (en contra por magnitud, luego a favor por magnitud)", () => {
    const filas = desviosV09(bva());
    // direct_cost (-1.4M, en contra) antes que operating_expense (+800k, a favor) y revenue (+2.5M, a favor)
    expect(filas[0]!.concepto).toBe("direct_cost");
    expect(filas[0]!.favorable).toBe(false);
    // entre los favorables, revenue (2.5M) antes que operating_expense (800k)
    expect(filas[1]!.concepto).toBe("revenue");
    expect(filas[2]!.concepto).toBe("operating_expense");
  });

  it("cada fila lee plan/real/desvio directo de BudgetLine, sin recalcular", () => {
    const fila = desviosV09(bva()).find((f) => f.concepto === "direct_cost")!;
    expect(fila.plan).toBe(-12_000_000);
    expect(fila.real).toBe(-13_400_000);
    expect(fila.desvio).toBe(-1_400_000);
    expect(fila.desvioPct).toBe(-11.7);
    expect(fila.favorable).toBe(false);
  });
});

describe("resultRealCoincideConResultado — INV-FIN-001 CANÓNICO (docs/factory/proposal-pack/08_BUSINESS_INVARIANTS.md: budget-vs-actual.actual.result == operational-result.result)", () => {
  it("true cuando el actual de result en budget-vs-actual = result de operational-result", () => {
    expect(resultRealCoincideConResultado(bva(), "10900000")).toBe(true);
  });

  /* Éste es EL test que fija el invariante: si el "Real" de esta pantalla alguna vez se deriva de
   * una fuente distinta de `budget-vs-actual`, o el backend deja de cumplir el contrato, esta
   * aserción cae. Números DELIBERADAMENTE distintos (10.900.000 vs 10.800.000). */
  it("false cuando el result de operational-result NO calza con el actual de budget-vs-actual", () => {
    expect(resultRealCoincideConResultado(bva(), "10800000")).toBe(false);
  });

  /* [caso adversarial del reviewer, PR #102 vuelta 2] `revenue` calza (32.500.000) pero `result`
   * diverge fuerte (~1,9M: 10.900.000 vs un `operational-result.result` hipotético de 9.000.000).
   * Antes de este fix, `revenueRealCoincideConResultado` sola daba `true` acá y NADA lo detectaba
   * (61/61 tests pasaban). El invariante canónico tiene que morir con este fixture. */
  it("[adversarial] false cuando revenue calza pero result diverge — revenueRealCoincideConResultado sola no detecta esto", () => {
    expect(revenueRealCoincideConResultado(bva(), "32500000")).toBe(true); // revenue SÍ calza
    expect(resultRealCoincideConResultado(bva(), "9000000")).toBe(false); // result NO calza
  });

  it("false cuando no viene la línea result (no hay con qué comparar)", () => {
    expect(
      resultRealCoincideConResultado(
        { lines: LINEAS_NORMALES.filter((l) => l.concept !== "result") },
        "10900000",
      ),
    ).toBe(false);
  });

  it("false cuando operational-result no trajo result (null/undefined) aunque haya línea", () => {
    expect(resultRealCoincideConResultado(bva(), null)).toBe(false);
    expect(resultRealCoincideConResultado(bva(), undefined)).toBe(false);
  });
});

describe("revenueRealCoincideConResultado — comprobación ADICIONAL sobre revenue, NUNCA sustituta de INV-FIN-001 (issue #74, verificado 2026-08-31)", () => {
  it("true cuando el actual de revenue en budget-vs-actual = revenue de operational-result", () => {
    expect(revenueRealCoincideConResultado(bva(), "32500000")).toBe(true);
  });

  it("false cuando el revenue de operational-result NO calza con el actual de budget-vs-actual", () => {
    expect(revenueRealCoincideConResultado(bva(), "32400000")).toBe(false);
  });

  it("false cuando no viene la línea revenue (no hay con qué comparar)", () => {
    expect(
      revenueRealCoincideConResultado(
        { lines: LINEAS_NORMALES.filter((l) => l.concept !== "revenue") },
        "32500000",
      ),
    ).toBe(false);
  });

  it("false cuando operational-result no trajo revenue (null/undefined) aunque haya línea", () => {
    expect(revenueRealCoincideConResultado(bva(), null)).toBe(false);
    expect(revenueRealCoincideConResultado(bva(), undefined)).toBe(false);
  });
});

describe("csvDesviosV09 — exportar (§5.5), exacto sobre lo mostrado", () => {
  it("una línea por fila, mismo desvio que el modelo (sin recalcular)", () => {
    const filas = desviosV09(bva());
    const csv = csvDesviosV09(filas);
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe("concepto;plan;real;desvio;desvio_pct");
    expect(lineas).toHaveLength(filas.length + 1);
    // direct_cost es la primera fila (peor primero): -1.400.000
    expect(lineas[1]).toBe("Costo directo;-12000000;-13400000;-1400000;-11.7");
  });

  it("[control positivo] con filas vacías, sólo queda el encabezado (no una fila fantasma)", () => {
    expect(csvDesviosV09([]).split("\n")).toHaveLength(1);
  });

  it("desvioPct null se exporta como 'sin dato', nunca 0 ni vacío ambiguo", () => {
    const filas = desviosV09(bva()).map((f) => ({ ...f, desvioPct: null }));
    const csv = csvDesviosV09(filas);
    expect(csv).toContain("sin dato");
    expect(csv).not.toMatch(/;0\n/);
  });
});

describe("concordar — N=1 singular, el resto plural (issue #94)", () => {
  it("N=1 usa el singular", () => {
    expect(concordar(1, "concepto", "conceptos")).toBe("concepto");
  });

  /* [control positivo] gemelo positivo del anterior con la MISMA pareja singular/plural: N≠1 no
   * puede devolver el singular. */
  it("[control positivo] N=2 usa el plural (no el singular de arriba)", () => {
    expect(concordar(2, "concepto", "conceptos")).toBe("conceptos");
  });

  it("N=0 usa el plural", () => {
    expect(concordar(0, "concepto", "conceptos")).toBe("conceptos");
  });
});
