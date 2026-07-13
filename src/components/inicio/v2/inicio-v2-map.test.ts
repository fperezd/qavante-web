import { describe, it, expect } from "vitest";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { CollectionForecastResponse } from "@/lib/api/treasury";
import {
  mapPulso,
  mapCaja,
  mapBrechaTotal,
  mapCobranza,
  mapCobranzaForecast,
  mapPlanBrecha,
  mapPagos,
  mapResultado,
  mapFrase,
  stampOf,
} from "./inicio-v2-map";

/** Summary vacío (empresa nueva / sin fuentes): todos los bloques null. */
function emptySummary(): DashboardSummaryV2 {
  return {
    executive_phrase: null,
    pulso: null,
    cash_today: null,
    cash_forecast: null,
    cash_gap: null,
    overdue_collections: null,
    critical_payments: null,
    operational_result: null,
    priority_actions: [],
  } as unknown as DashboardSummaryV2;
}

describe("inicio-v2-map — degradación honesta (bloque ausente → null)", () => {
  it("todos los mappers devuelven null con summary vacío", () => {
    const s = emptySummary();
    expect(mapPulso(s)).toBeNull();
    expect(mapCaja(s)).toBeNull();
    expect(mapBrechaTotal(s)).toBeNull();
    expect(mapCobranza(s)).toBeNull();
    expect(mapPagos(s, new Date("2026-07-12"))).toBeNull();
    expect(mapResultado(s)).toBeNull();
    expect(mapFrase(s)).toBe("");
  });
});

describe("mapPulso", () => {
  it("mapea score/status/confianza y drivers como factores; sin tendencia (Fase 2)", () => {
    const s = {
      ...emptySummary(),
      pulso: {
        score: 33,
        status: "critical",
        confidence: "high",
        top_driver_positive: "Cobranza sube",
        top_driver_negative: "Días de caja caen",
        preliminary: false,
      },
    } as unknown as DashboardSummaryV2;
    const p = mapPulso(s)!;
    expect(p.score).toBe(33);
    expect(p.status).toBe("critical");
    expect(p.confianza).toBe("Confianza de los datos: alta");
    expect(p.factores).toHaveLength(2);
    expect(p.factores[0]).toEqual({ label: "Cobranza sube", tono: "ok" });
    expect(p.tendencia).toEqual([]); // sin serie q_score aún
    expect(p.delta).toBe("");
  });
});

describe("mapCaja", () => {
  it("caja hoy + mínimas con tono por signo; serie del campo v2 si viene", () => {
    const s = {
      ...emptySummary(),
      cash_today: { total: "-1518883", last_updated: "2026-07-08", data_state: "estimated" },
      cash_forecast: { min_14d: "-5737505", min_30d: "-5737505", days_of_cash: 0, last_updated: "2026-07-08", source: "banco" },
      cash_sparkline: [100, -50, -200],
    } as unknown as DashboardSummaryV2;
    const c = mapCaja(s)!;
    expect(c.cajaHoy).toBe(-1518883);
    expect(c.filas).toHaveLength(3);
    expect(c.filas[0]!.tono).toBe("neg");
    expect(c.filas[2]).toEqual({ label: "Días de caja", valor: "~0", tono: "neg" });
    expect(c.serie).toEqual([100, -50, -200]);
  });

  it("sin cash_sparkline → serie vacía (degrada, no inventa)", () => {
    const s = { ...emptySummary(), cash_today: { total: "1000", last_updated: "2026-07-08", data_state: "available" } } as unknown as DashboardSummaryV2;
    expect(mapCaja(s)!.serie).toEqual([]);
  });
});

describe("mapBrechaTotal", () => {
  it("brecha = obligaciones − caja proyectada, solo si has_gap y > 0", () => {
    const s = {
      ...emptySummary(),
      cash_gap: { has_gap: true, critical_obligations_14d: "4218622", projected_cash_14d: "-5737505" },
    } as unknown as DashboardSummaryV2;
    expect(mapBrechaTotal(s)).toBe(9956127);
  });
  it("null cuando no hay gap", () => {
    const s = { ...emptySummary(), cash_gap: { has_gap: false } } as unknown as DashboardSummaryV2;
    expect(mapBrechaTotal(s)).toBeNull();
  });
});

describe("mapCobranza (degradada sin Fase 2)", () => {
  it("total por cobrar + vencido, sin segmentos", () => {
    const s = {
      ...emptySummary(),
      overdue_collections: { total_receivable: "205400000", overdue: "0" },
    } as unknown as DashboardSummaryV2;
    const c = mapCobranza(s)!;
    expect(c.totalPorCobrar).toBe(205400000);
    expect(c.vencido).toBe(0);
    expect(c.segmentos).toEqual([]);
    expect(c.subtitulo).toBe("Por cobrar");
  });
});

describe("mapCobranzaForecast (Fase 2 · collection-forecast)", () => {
  const forecast = {
    as_of: "2026-07-12",
    total_nominal: "205400000",
    total_expected: "180000000",
    overdue: { nominal: "0", expected: "0" },
    sin_vencimiento: { nominal: "0", expected: "0" },
    beyond_horizon: { nominal: "0", expected: "0" },
    buckets: [
      { label: "0-7d", nominal: "10000000", expected: "8000000", days_from: 0, days_to: 7 },
      { label: "8-14d", nominal: "6000000", expected: "4000000", days_from: 8, days_to: 14 },
      { label: "15-30d", nominal: "5000000", expected: "3000000", days_from: 15, days_to: 30 },
      { label: "31-60d", nominal: "2000000", expected: "1000000", days_from: 31, days_to: 60 },
    ],
  } as unknown as CollectionForecastResponse;

  it("esperado a tiempo = Σ expected de buckets ≤14d; segmentos ≤30d con banda por recencia", () => {
    const c = mapCobranzaForecast(forecast);
    expect(c.esperadoATiempo).toBe(12_000_000); // 8M (0-7) + 4M (8-14)
    expect(c.segmentos).toHaveLength(3); // ≤30d (excluye 31-60)
    expect(c.segmentos[0]!.banda).toBe("high"); // 0-7d
    expect(c.segmentos[1]!.banda).toBe("probable"); // 8-14d
    expect(c.segmentos[2]!.banda).toBe("unknown"); // 15-30d
    expect(c.segmentos[0]!.monto).toBe(8_000_000); // usa expected, no nominal
    expect(c.totalPorCobrar).toBe(205_400_000); // nominal
    expect(c.vencido).toBe(0);
  });
});

describe("mapPlanBrecha (Fase 2 · brecha + forecast)", () => {
  // esperado a tiempo (≤14d) = 4M + 3M = 7M
  const forecast = {
    total_nominal: "100000000",
    overdue: { nominal: "0", expected: "0" },
    buckets: [
      { label: "0-7d", nominal: "6000000", expected: "4000000", days_from: 0, days_to: 7 },
      { label: "8-14d", nominal: "4000000", expected: "3000000", days_from: 8, days_to: 14 },
      { label: "15-30d", nominal: "9000000", expected: "5000000", days_from: 15, days_to: 30 },
    ],
  } as unknown as import("@/lib/api/treasury").CollectionForecastResponse;

  it("brecha parcial: acción cobrar (probable) + residual a financiar (por evaluar)", () => {
    const p = mapPlanBrecha(10_000_000, forecast);
    expect(p.brechaTotal).toBe(10_000_000);
    expect(p.acciones).toHaveLength(2);
    expect(p.acciones[0]!.impacto).toBe(7_000_000);
    expect(p.acciones[0]!.estado).toBe("probable");
    expect(p.acciones[0]!.brechaRestante).toBe(-3_000_000);
    expect(p.acciones[1]!.impacto).toBe(3_000_000);
    expect(p.acciones[1]!.estado).toBe("por_evaluar");
    expect(p.acciones[1]!.restanteNota).toBe("si se aprueba");
    expect(p.coberturaIdentificada).toBe(7_000_000);
    expect(p.pendienteAsegurar).toBe(3_000_000);
  });

  it("brecha cubierta por la cobranza: 1 acción, sin pendiente", () => {
    const p = mapPlanBrecha(5_000_000, forecast); // esperado 7M ≥ 5M
    expect(p.acciones).toHaveLength(1);
    expect(p.acciones[0]!.impacto).toBe(5_000_000); // min(7M, brecha)
    expect(p.acciones[0]!.brechaRestante).toBe(0);
    expect(p.pendienteAsegurar).toBe(0);
  });
});

describe("mapPagos (key_obligations)", () => {
  const now = new Date(2026, 6, 12); // 12-jul-2026 LOCAL (determinista, sin UTC drift)
  it("mapea hasta 3 fechas clave; marca vencido y tag por cobertura", () => {
    const s = {
      ...emptySummary(),
      key_obligations: [
        { key: "sueldos", label: "Remuneraciones", due_date: "2026-06-30", amount: "8600000", coverage: "uncovered" },
        { key: "impuestos_mensuales", label: "IVA / F29", due_date: "2026-07-20", amount: "4214448", coverage: "tight" },
      ],
    } as unknown as DashboardSummaryV2;
    const p = mapPagos(s, now)!;
    expect(p.pagos).toHaveLength(2);
    expect(p.pagos[0]!.vencido).toBe(true); // 30-06 < 12-07
    expect(p.pagos[0]!.fecha.startsWith("Venció")).toBe(true);
    expect(p.pagos[0]!.tipo).toBe("sin_cobertura"); // uncovered
    expect(p.pagos[1]!.vencido).toBe(false);
    expect(p.pagos[1]!.tipo).toBe("negociable"); // tight
    expect(p.total).toBe(12814448);
    expect(p.totalEnRojo).toBe(true);
  });
  it("un pago que vence HOY NO está vencido (sin off-by-one de timezone)", () => {
    const s = {
      ...emptySummary(),
      key_obligations: [
        { key: "sueldos", label: "Remuneraciones", due_date: "2026-07-12", amount: "1000", coverage: "covered" },
      ],
    } as unknown as DashboardSummaryV2;
    const p = mapPagos(s, now)!;
    expect(p.pagos[0]!.vencido).toBe(false);
    expect(p.pagos[0]!.fecha.startsWith("Vence")).toBe(true);
  });
  it("null si no vienen key_obligations (degrada a la vista)", () => {
    expect(mapPagos(emptySummary(), now)).toBeNull();
  });
});

describe("mapResultado", () => {
  it("margen computado; sin preliminar/rango/extra (no están en el summary)", () => {
    const s = {
      ...emptySummary(),
      operational_result: { revenue: "8855032", gross_margin: "8855032", ebitda_proxy: "0", result: "7926679" },
    } as unknown as DashboardSummaryV2;
    const r = mapResultado(s)!;
    expect(r.resultado).toBe(7926679);
    expect(r.ingresos).toBe(8855032);
    expect(r.margen).toBe("90%"); // 7.926.679 / 8.855.032 = 89,5% → redondea a 90%
    expect(r.margenLabel).toBe("Margen operacional");
    expect(r.extra).toEqual([]);
    expect(r.caveat).toBeUndefined();
  });
});

describe("stampOf", () => {
  it("omite lo ausente", () => {
    expect(stampOf(null, "banco")).toBe("Fuente: banco");
    expect(stampOf(undefined, undefined)).toBe("");
  });
});
