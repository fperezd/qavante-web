import { describe, it, expect } from "vitest";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { CollectionForecastResponse, CashCycleResponse } from "@/lib/api/treasury";
import {
  mapPulso,
  mapCaja,
  mapBrechaTotal,
  mapEstadoBrecha,
  respuestaEstadoBrecha,
  margenPlausiblePct,
  cicloCajaExtra,
  mapCobranza,
  mapCobranzaForecast,
  mapPlanBrecha,
  mapPagos,
  mapResultado,
  mapFrase,
  stampOf,
} from "./inicio-v2-map";
import { DEFICIT, NO_DEFICIT } from "../resumen/inicio-resumen.fixtures";

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
      cash_forecast: {
        min_14d: "-5737505",
        min_30d: "-5737505",
        days_of_cash: 0,
        last_updated: "2026-07-08",
        source: "banco",
      },
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
    const s = {
      ...emptySummary(),
      cash_today: { total: "1000", last_updated: "2026-07-08", data_state: "available" },
    } as unknown as DashboardSummaryV2;
    expect(mapCaja(s)!.serie).toEqual([]);
  });

  it("SIN cash_today (banco caído) → saldo DESCONOCIDO (null), no $0 (faltante ≠ 0)", () => {
    const s = {
      ...emptySummary(),
      cash_forecast: {
        min_14d: "-100",
        min_30d: "-100",
        days_of_cash: 0,
        last_updated: "2026-07-08",
        source: "banco",
      },
    } as unknown as DashboardSummaryV2;
    const c = mapCaja(s)!;
    expect(c.cajaHoy).toBeNull(); // ← nunca 0
    expect(c.subtitulo).toMatch(/Sin dato de saldo/);
  });

  it("el subtítulo refleja la frescura que declara el backend", () => {
    const base = { ...emptySummary(), cash_forecast: null };
    const con = (state: string) =>
      mapCaja({
        ...base,
        cash_today: { total: "1000", last_updated: "2026-07-08", data_state: state },
      } as unknown as DashboardSummaryV2)!.subtitulo;
    expect(con("available")).toBe("Caja hoy");
    expect(con("stale")).toBe("Caja hoy · desactualizada");
    expect(con("estimated")).toBe("Caja hoy · estimada");
  });
});

describe("mapBrechaTotal / mapEstadoBrecha — la brecha es la que publica el contrato (D01/D03)", () => {
  /* CONTRASTE PREVIO (#296). Con el fixture canónico del repo (`cash_gap_amount_14d` 14.000.000,
   * `projected_cash_14d` −10.000.000, `min_14d` −14.000.000) la versión anterior publicaba
   * 10.000.000: el saldo final con el signo cambiado, reconstruido en el front. Saldo final ≠
   * mínimo ≠ brecha: el número del plan es el que publica el backend. */
  it("con el fixture DEFICIT publica 14.000.000 (cash_gap_amount_14d), no el saldo final", () => {
    expect(mapBrechaTotal(DEFICIT)).toBe(14_000_000);
    expect(mapBrechaTotal(DEFICIT)).not.toBe(10_000_000); // lo que publicaba la versión anterior
    expect(mapEstadoBrecha(DEFICIT)).toEqual({ tipo: "brecha", monto: 14_000_000 });
  });

  it("GEMELO POSITIVO · sin brecha (cash_gap_amount_14d 0, has_gap false) → cubierto y null", () => {
    expect(mapBrechaTotal(NO_DEFICIT)).toBeNull();
    expect(mapEstadoBrecha(NO_DEFICIT)).toEqual({ tipo: "cubierto" });
  });

  it("brecha declarada con monto ausente → indeterminado, nunca $0 ni un saldo reconstruido", () => {
    const s: DashboardSummaryV2 = {
      ...DEFICIT,
      cash_gap: { ...DEFICIT.cash_gap!, cash_gap_amount_14d: "" },
    };
    expect(mapEstadoBrecha(s)).toEqual({ tipo: "indeterminado" });
    expect(mapBrechaTotal(s)).toBeNull();
  });

  it("sin cash_gap_amount_14d el front NO reconstruye el monto desde críticas y saldo final", () => {
    /* Las dos formas que tenía la versión anterior, ahora sin efecto: con saldo negativo
     * publicaba −saldo (5.737.505); con saldo positivo, críticas − caja (3.218.622). Sin el monto
     * del contrato la brecha queda declarada, no cuantificada. */
    const negativo = {
      ...emptySummary(),
      cash_gap: {
        has_gap: true,
        critical_obligations_14d: "4218622",
        projected_cash_14d: "-5737505",
      },
    } as unknown as DashboardSummaryV2;
    expect(mapEstadoBrecha(negativo)).toEqual({ tipo: "indeterminado" });
    expect(mapBrechaTotal(negativo)).toBeNull();
    const positivo = {
      ...emptySummary(),
      cash_gap: {
        has_gap: true,
        critical_obligations_14d: "4218622",
        projected_cash_14d: "1000000",
      },
    } as unknown as DashboardSummaryV2;
    expect(mapEstadoBrecha(positivo)).toEqual({ tipo: "indeterminado" });
    expect(mapBrechaTotal(positivo)).toBeNull();
  });
  it("el copy Q1 publica la brecha canónica con su apellido, no una suma ni un saldo", () => {
    expect(respuestaEstadoBrecha(mapEstadoBrecha(DEFICIT))).toBe(
      "La empresa debe asegurar $14.000.000 para que su caja no quede bajo cero en los próximos 14 días.",
    );
    expect(respuestaEstadoBrecha({ tipo: "indeterminado" })).toBe(
      "Hay una brecha de caja declarada, pero no podemos cuantificarla con los datos de hoy.",
    );
    expect(respuestaEstadoBrecha({ tipo: "cubierto" })).toBe(
      "La caja proyectada cubre las obligaciones críticas de los próximos 14 días.",
    );
  });
  it("null cuando no hay gap", () => {
    const s = { ...emptySummary(), cash_gap: { has_gap: false } } as unknown as DashboardSummaryV2;
    expect(mapBrechaTotal(s)).toBeNull();
    expect(mapEstadoBrecha(s)).toEqual({ tipo: "cubierto" });
  });
  it("has_gap TRUE con monto publicado → brecha aunque el saldo final sea holgado", () => {
    // El backend sabe del valle intra-período; un cierre positivo no lo borra (D03).
    const s = {
      ...emptySummary(),
      cash_gap: {
        has_gap: true,
        cash_gap_amount_14d: "1500000",
        critical_obligations_14d: "4218622",
        projected_cash_14d: "9000000",
      },
    } as unknown as DashboardSummaryV2;
    expect(mapEstadoBrecha(s)).toEqual({ tipo: "brecha", monto: 1_500_000 });
    expect(mapBrechaTotal(s)).toBe(1_500_000);
  });
  it("SIN obligaciones críticas ($0) y saldo negativo → 'indeterminado', NO una brecha falsa", () => {
    // Caso real Tooxs: críticas=0, caja=−3.935.682, sin monto publicado. El saldo bajo cero NO es
    // la brecha (D03) → no dispara el plan de cierre con un número que el backend no publicó.
    const s = {
      ...emptySummary(),
      cash_gap: { has_gap: true, critical_obligations_14d: "0", projected_cash_14d: "-3935682.15" },
    } as unknown as DashboardSummaryV2;
    expect(mapEstadoBrecha(s)).toEqual({ tipo: "indeterminado" });
    expect(mapBrechaTotal(s)).toBeNull();
  });
  it("sin bloque cash_gap → sin_dato (no se afirma cobertura)", () => {
    expect(mapEstadoBrecha(emptySummary())).toEqual({ tipo: "sin_dato" });
  });
});

describe("margenPlausiblePct", () => {
  it("margen normal, CRUDO (el redondeo lo hace formatPct, no el modelo)", () => {
    /* Antes devolvía `9` y la pantalla mostraba "9%" mientras Gestión, sobre el
       MISMO cociente, mostraba "9,3%". Un número, dos pantallas, dos valores. */
    expect(margenPlausiblePct(4_500_000, 48_200_000)).toBeCloseTo(9.3361, 4);
  });
  it("null si |resultado| > ingresos (imposible: faltan costos)", () => {
    expect(margenPlausiblePct(13_228_093, 12_907_155)).toBeNull(); // el caso real de prod
    expect(margenPlausiblePct(-50_000_000, 1_000_000)).toBeNull();
  });
  it("null sin ingresos", () => {
    expect(margenPlausiblePct(100, 0)).toBeNull();
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

  it("overdue null (SII sin vencimientos) → vencido null, NO 0 (no mentir 'al día')", () => {
    const s = {
      ...emptySummary(),
      overdue_collections: { total_receivable: "205400000", overdue: null },
    } as unknown as DashboardSummaryV2;
    const c = mapCobranza(s)!;
    expect(c.totalPorCobrar).toBe(205400000);
    expect(c.vencido).toBeNull(); // parseAmount(null) daría 0; debe preservar el null
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

  it("esperado a tiempo = Σ expected ≤14d; segmentos ≤14d reconcilian con el headline", () => {
    const c = mapCobranzaForecast(forecast)!;
    expect(c.esperadoATiempo).toBe(12_000_000); // 8M (0-7) + 4M (8-14)
    expect(c.segmentos).toHaveLength(2); // solo ≤14d (excluye 15-30, 31-60)
    expect(c.segmentos[0]!.banda).toBe("high"); // 0-7d
    expect(c.segmentos[1]!.banda).toBe("probable"); // 8-14d
    expect(c.segmentos[0]!.monto).toBe(8_000_000); // expected, no nominal
    // La suma de los segmentos = el headline (reconcilian, no confunde).
    expect(c.segmentos[0]!.monto + c.segmentos[1]!.monto).toBe(c.esperadoATiempo);
    expect(c.totalPorCobrar).toBe(205_400_000); // nominal
    expect(c.vencido).toBe(0);
  });
  it("null cuando no hay cuentas por cobrar (total 0) — omite lo ausente", () => {
    const zero = { ...forecast, total_nominal: "0" } as unknown as CollectionForecastResponse;
    expect(mapCobranzaForecast(zero)).toBeNull();
  });
  it("overdue 0 pero receivables SIN fecha (sin_vencimiento>0) → vencido null, NO 0 (no mentir 'al día')", () => {
    const conSinFecha = {
      ...forecast,
      overdue: { nominal: "0", expected: "0" },
      sin_vencimiento: { nominal: "30000000", expected: "0" },
    } as unknown as CollectionForecastResponse;
    // Hay $30M de cuentas por cobrar de vencimiento desconocido → no sabemos si están
    // vencidas; pintar "$0 vencido — al día" mentiría (espeja #718/#731).
    expect(mapCobranzaForecast(conSinFecha)!.vencido).toBeNull();
  });
  it("overdue>0 → muestra el vencido real aunque también haya sin_vencimiento", () => {
    const conVencido = {
      ...forecast,
      overdue: { nominal: "12000000", expected: "0" },
      sin_vencimiento: { nominal: "5000000", expected: "0" },
    } as unknown as CollectionForecastResponse;
    expect(mapCobranzaForecast(conVencido)!.vencido).toBe(12_000_000);
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
    const p = mapPlanBrecha(10_000_000, forecast)!;
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
    const p = mapPlanBrecha(5_000_000, forecast)!; // esperado 7M ≥ 5M
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
        {
          key: "sueldos",
          label: "Remuneraciones",
          due_date: "2026-06-30",
          amount: "8600000",
          coverage: "uncovered",
        },
        {
          key: "impuestos_mensuales",
          label: "IVA / F29",
          due_date: "2026-07-20",
          amount: "4214448",
          coverage: "tight",
        },
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
        {
          key: "sueldos",
          label: "Remuneraciones",
          due_date: "2026-07-12",
          amount: "1000",
          coverage: "covered",
        },
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
      operational_result: {
        revenue: "8855032",
        gross_margin: "8855032",
        ebitda_proxy: "0",
        result: "7926679",
      },
    } as unknown as DashboardSummaryV2;
    const r = mapResultado(s)!;
    expect(r.resultado).toBe(7926679);
    expect(r.ingresos).toBe(8855032);
    // 7.926.679 / 8.855.032 = 89,5%. Es el mismo valor que muestra Gestión.
    expect(r.margen).toBe("89,5%");
    expect(r.margenLabel).toBe("Margen operacional");
    expect(r.extra).toEqual([]);
    expect(r.caveat).toBeUndefined();
  });
});

describe("cicloCajaExtra (Fase 2 · cash-cycle)", () => {
  it("fila DSO/DPO cuando hay dato", () => {
    expect(cicloCajaExtra({ dso_days: 42, dpo_days: 28 } as unknown as CashCycleResponse)).toEqual({
      label: "Ciclo de caja (cobra / paga)",
      valor: "42d / 28d",
    });
  });
  it("null sin DSO calculable", () => {
    expect(cicloCajaExtra(undefined)).toBeNull();
    expect(cicloCajaExtra({ dso_days: null } as unknown as CashCycleResponse)).toBeNull();
  });
  it("DPO nulo → 'Sin información'", () => {
    expect(
      cicloCajaExtra({ dso_days: 42, dpo_days: null } as unknown as CashCycleResponse)!.valor,
    ).toBe("42d / Sin información");
  });
});

describe("stampOf", () => {
  it("omite lo ausente", () => {
    expect(stampOf(null, "banco")).toBe("Fuente: banco");
    expect(stampOf(undefined, undefined)).toBe("");
  });
});
