import { describe, it, expect } from "vitest";
import {
  mesCorto,
  margenOperacionalPct,
  resultadoConfiable,
  deCada100Confiable,
  mapHero,
  mapComparativos,
  mapCascada,
  mapDrivers,
  mapTendencia,
  separarMesEnCurso,
  tendenciaConfiable,
  evaluarTendenciaMargen,
} from "./gestion-v2-map";
import { computeCascada } from "./cascada-model";
import type { TendenciaPunto } from "./tendencia-resultado";
import type { OperationalResultResponse, OperationalResultBreakdown } from "@/lib/api/gestion";

const RESP: OperationalResultResponse = {
  period: "2026-07",
  revenue: "48200000",
  direct_cost: "21400000",
  gross_margin: "26800000",
  gross_margin_pct: "55.6",
  labor_cost: "14900000",
  professional_fees: "2300000",
  recurring_expenses: "5100000",
  ebitda_proxy: "4500000",
  financial_expense: "0",
  unclassified: "0",
  result: "4500000",
  variation: {
    vs_previous_month: { amount: "500000", pct: "12.5" },
    vs_same_month_last_year: { amount: "1140000", pct: "34.0" },
  },
  drivers: [
    { direction: "improves", concept: "Ventas", impact: "3200000", explanation: "Subieron 8%." },
    {
      direction: "worsens",
      concept: "Sueldos",
      impact: "1100000",
      explanation: "Sumaste 1 persona.",
    },
  ],
  confidence: "high",
  data_state: "available",
  missing_sources: [],
  generated_at: "2026-07-14T12:00:00Z",
};

describe("mesCorto", () => {
  it("YYYY-MM → mes corto", () => {
    expect(mesCorto("2026-07")).toBe("jul");
    expect(mesCorto("2026-01-15")).toBe("ene");
  });
});

describe("margenOperacionalPct", () => {
  it("resultado / ingresos * 100", () => {
    expect(margenOperacionalPct(RESP)).toBeCloseTo(9.34, 1);
  });
  it("0 si no hay ingresos", () => {
    expect(margenOperacionalPct({ ...RESP, revenue: "0" })).toBe(0);
  });
  it("0 con ingresos negativos (no invierte el signo)", () => {
    expect(margenOperacionalPct({ ...RESP, revenue: "-1000000", result: "-3000000" })).toBe(0);
  });
});

describe("resultadoConfiable", () => {
  it("confiable con un P&L normal", () => {
    expect(resultadoConfiable(RESP)).toBe(true);
  });
  it("NO confiable si el resultado supera a los ingresos (margen > 100%)", () => {
    // Caso real de prod (Tooxs jul-2026): revenue 18,74M, result 18,93M → 101% (gasto revertido).
    expect(
      resultadoConfiable({
        ...RESP,
        revenue: "18739791",
        direct_cost: "0",
        labor_cost: "0",
        professional_fees: "0",
        recurring_expenses: "-194098",
        result: "18933889",
      }),
    ).toBe(false);
  });
  it("NO confiable si el resultado IGUALA a los ingresos (margen 100% ⇒ costos netos ≤ 0)", () => {
    expect(resultadoConfiable({ ...RESP, revenue: "10000000", result: "10000000" })).toBe(false);
  });
  it("SÍ confiable aunque los costos vengan agrupados en recurring_expenses (empresa de servicios)", () => {
    // Caso real de prod (Tooxs jun-2026): sin direct_cost/labor/fees propios (todo en recurring),
    // margen 40% plausible. El guard viejo lo degradaba por mirar solo los 3 buckets clave.
    expect(
      resultadoConfiable({
        ...RESP,
        revenue: "25845693",
        direct_cost: "0",
        labor_cost: "0",
        professional_fees: "0",
        recurring_expenses: "13705506",
        result: "10325814",
      }),
    ).toBe(true);
  });
  it("no aplica la guarda sin ingresos (otro caso: vacío/parcial)", () => {
    expect(resultadoConfiable({ ...RESP, revenue: "0" })).toBe(true);
  });
});

describe("deCada100Confiable", () => {
  it("confiable con un P&L normal (bruto entre resultado e ingresos)", () => {
    expect(deCada100Confiable(RESP)).toBe(true);
  });
  it("NO confiable si el margen bruto supera los ingresos (COGS negativo por reversa de NC)", () => {
    // rev 1.000, bruto 1.200 (COGS −200), gastos 300, resultado 900 → los tramos sumarían 120%.
    expect(
      deCada100Confiable({ ...RESP, revenue: "1000", gross_margin: "1200", result: "900" }),
    ).toBe(false);
  });
  it("NO confiable si el resultado supera al bruto, o sin ingresos", () => {
    expect(
      deCada100Confiable({ ...RESP, revenue: "1000", gross_margin: "500", result: "600" }),
    ).toBe(false);
    expect(deCada100Confiable({ ...RESP, revenue: "0" })).toBe(false);
  });
});

describe("tendenciaConfiable", () => {
  it("confiable con márgenes normales", () => {
    expect(
      tendenciaConfiable([
        { periodo: "jun", margenPct: 8.6 },
        { periodo: "jul", margenPct: 9.3 },
      ]),
    ).toBe(true);
  });
  it("NO confiable si algún mes tiene margen > 100% (bug de costos)", () => {
    expect(
      tendenciaConfiable([
        { periodo: "jun", margenPct: 47 },
        { periodo: "jul", margenPct: 102.5 },
      ]),
    ).toBe(false);
  });
});

describe("mapHero", () => {
  it("ganó → título y tono ok, frase de variación", () => {
    const h = mapHero(RESP);
    expect(h.titulo).toBe("El negocio ganó este mes");
    expect(h.resultado).toBe(4_500_000);
    // Lidera con el MONTO (no el %, que explota en bases chicas). RESP: amount 500000.
    expect(h.respuesta).toMatch(/\$500\.000 mejor/);
    expect(h.respuesta).not.toMatch(/%/);
    expect(h.respuestaTono).toBe("ok");
  });
  it("perdió → título y número negativo", () => {
    const h = mapHero({
      ...RESP,
      result: "-3000000",
      variation: { vs_previous_month: { amount: "-1", pct: "-20" }, vs_same_month_last_year: null },
    });
    expect(h.titulo).toBe("El negocio perdió este mes");
    expect(h.resultado).toBe(-3_000_000);
    expect(h.respuesta).toMatch(/peor/);
    expect(h.respuestaTono).toBe("bad");
  });
  it("sin mes anterior → frase honesta de primer mes", () => {
    const h = mapHero({
      ...RESP,
      variation: { vs_previous_month: null, vs_same_month_last_year: null },
    });
    expect(h.respuesta).toMatch(/Primer mes/);
  });
  it("no crashea si el backend omite `variation` (parcial)", () => {
    const parcial = { ...RESP } as OperationalResultResponse;
    // @ts-expect-error simulamos respuesta parcial sin `variation`
    delete parcial.variation;
    expect(() => mapHero(parcial)).not.toThrow();
    expect(() => mapComparativos(parcial)).not.toThrow();
    expect(mapComparativos(parcial)).toEqual([]);
  });
});

describe("mapComparativos", () => {
  it("mes a mes en MONTO (el % explota en base chica), año a año en %", () => {
    const c = mapComparativos(RESP);
    expect(c).toHaveLength(2);
    // vs mes anterior → monto con signo, NO %.
    expect(c[0]).toEqual({ label: "vs. mes anterior", texto: "+$500.000", positivo: true });
    // vs mismo mes año anterior → % (base estable, señal de tendencia).
    expect(c[1]!.label).toBe("vs. mismo mes año anterior");
    expect(c[1]!.texto).toContain("%");
    expect(c[1]!.positivo).toBe(true);
  });
  it("degrada si falta uno", () => {
    const c = mapComparativos({
      ...RESP,
      variation: { vs_previous_month: { amount: "1", pct: "5" }, vs_same_month_last_year: null },
    });
    expect(c).toHaveLength(1);
  });
});

describe("mapCascada", () => {
  it("footea a `result` y trae margen bruto y neto en %", () => {
    const entradas = mapCascada(RESP);
    const barras = computeCascada(entradas);
    const res = barras.find((b) => b.id === "resultado")!;
    expect(res.montoFirmado).toBe(4_500_000); // 48.2 − 21.4 − 14.9 − 2.3 − 5.1
    expect(barras.find((b) => b.id === "margen-bruto")!.pct).toBeCloseTo(55.6, 1);
    expect(res.pct).toBeCloseTo(9.34, 1);
    expect(entradas.find((e) => e.id === "otros")).toBeUndefined(); // footea → sin "Otros"
  });

  it("inserta 'Otros' (ajuste firmado) si las líneas no footean a `result`", () => {
    // result = 3.0M pero las 5 líneas dan 4.5M → ajuste = 3.0 − 4.5 = −1.5M (resta).
    const entradas = mapCascada({ ...RESP, result: "3000000" });
    const otros = entradas.find((e) => e.id === "otros");
    expect(otros).toMatchObject({ tipo: "ajuste", monto: -1_500_000 });
    const barras = computeCascada(entradas);
    expect(barras.find((b) => b.id === "resultado")!.montoFirmado).toBe(3_000_000); // ahora footea
  });
});

describe("mapDrivers", () => {
  it("mapea concepto/impacto/dirección", () => {
    const d = mapDrivers(RESP);
    expect(d[0]).toMatchObject({ direccion: "improves", concepto: "Ventas", impacto: 3_200_000 });
    expect(d[1]?.direccion).toBe("worsens");
  });
});

describe("mapTendencia", () => {
  const BD: OperationalResultBreakdown = {
    generated_at: "2026-07-14T12:00:00Z",
    period_from: "2026-06",
    period_to: "2026-07",
    mode: "por_cuenta",
    months: ["2026-06", "2026-07"],
    proforma_month: "2026-07",
    rows: [
      {
        kind: "section",
        key: "income",
        label: "Ingresos",
        by_month: ["46000000", "48200000"],
        total: "94200000",
      },
      {
        kind: "subtotal",
        key: "operational_result",
        label: "Resultado operacional",
        by_month: ["4000000", "4500000"],
        total: "8500000",
        pct_by_month: ["8.6", "9.3"],
        pct_total: "9.0",
      },
    ] as OperationalResultBreakdown["rows"],
  };

  it("saca el margen por mes de la fila de resultado y marca el mes en curso", () => {
    const t = mapTendencia(BD);
    expect(t).toHaveLength(2);
    expect(t[0]).toEqual({
      periodo: "jun",
      periodoFull: "2026-06",
      margenPct: 8.6,
      resultado: 4_000_000,
      actual: false,
    });
    expect(t[1]).toEqual({
      periodo: "jul",
      periodoFull: "2026-07",
      margenPct: 9.3,
      resultado: 4_500_000,
      actual: true,
    });
  });

  it("degrada a [] si no hay pct_by_month", () => {
    const bd2 = {
      ...BD,
      rows: [
        { kind: "subtotal", key: "x", label: "x", by_month: ["1"], total: "1" },
      ] as OperationalResultBreakdown["rows"],
    };
    expect(mapTendencia(bd2)).toEqual([]);
  });

  it("degrada a [] si los arrays no alinean con months (no corre los meses)", () => {
    const desalineado = {
      ...BD,
      rows: [
        {
          kind: "subtotal",
          key: "operational_result",
          label: "Resultado operacional",
          by_month: ["4500000"],
          total: "4500000",
          pct_by_month: ["9.3"],
        },
      ] as OperationalResultBreakdown["rows"],
    };
    expect(mapTendencia(desalineado)).toEqual([]); // months tiene 2, la fila 1
  });

  it("prefiere 'Resultado operacional' por sobre 'Margen operacional'", () => {
    const conAmbos = {
      ...BD,
      rows: [
        {
          kind: "subtotal",
          key: "gross_margin",
          label: "Margen operacional",
          by_month: ["10", "11"],
          total: "21",
          pct_by_month: ["10", "11"],
        },
        {
          kind: "subtotal",
          key: "operational_result",
          label: "Resultado operacional",
          by_month: ["4000000", "4500000"],
          total: "8500000",
          pct_by_month: ["8.6", "9.3"],
        },
      ] as OperationalResultBreakdown["rows"],
    };
    expect(mapTendencia(conAmbos)[1]?.margenPct).toBe(9.3); // el del resultado, no 11
  });
});

describe("separarMesEnCurso", () => {
  const pt = (margenPct: number, actual = false): TendenciaPunto => ({
    periodo: "x",
    margenPct,
    actual,
  });

  it("saca el mes marcado `actual` a `enCurso` y deja el resto en `cerrados`", () => {
    const { cerrados, enCurso } = separarMesEnCurso([pt(20.4), pt(23.2), pt(-1443.5, true)]);
    expect(cerrados.map((p) => p.margenPct)).toEqual([20.4, 23.2]); // el −1443% (día 3) NO cuenta
    expect(enCurso?.margenPct).toBe(-1443.5);
  });

  it("sin mes en curso: enCurso=null, cerrados = todos", () => {
    const { cerrados, enCurso } = separarMesEnCurso([pt(20.4), pt(23.2)]);
    expect(enCurso).toBeNull();
    expect(cerrados).toHaveLength(2);
  });

  it("vacío → cerrados vacío, enCurso null", () => {
    expect(separarMesEnCurso([])).toEqual({ cerrados: [], enCurso: null });
  });
});

describe("evaluarTendenciaMargen", () => {
  const pt = (margenPct: number, i: number) => ({
    periodo: `2026-0${i}`,
    margenPct,
    resultado: 0,
  });

  it("deterioro material (baja ≥ 3pp) → veredicto baja con desde/hasta/meses", () => {
    const v = evaluarTendenciaMargen([pt(82, 1), pt(80, 2), pt(78, 3)]);
    expect(v).not.toBeNull();
    expect(v!.baja).toBe(true);
    expect(v!.desde).toBe(82);
    expect(v!.hasta).toBe(78);
    expect(v!.meses).toBe(2);
  });

  it("mejora material (sube ≥ 3pp) → baja=false", () => {
    const v = evaluarTendenciaMargen([pt(70, 1), pt(75, 2)]);
    expect(v!.baja).toBe(false);
    expect(v!.deltaPp).toBe(5);
  });

  it("cambio inmaterial (< 3pp) → null (sin ruido)", () => {
    expect(evaluarTendenciaMargen([pt(80, 1), pt(78.5, 2)])).toBeNull();
  });

  it("menos de 2 puntos → null", () => {
    expect(evaluarTendenciaMargen([pt(80, 1)])).toBeNull();
    expect(evaluarTendenciaMargen([])).toBeNull();
  });
});
