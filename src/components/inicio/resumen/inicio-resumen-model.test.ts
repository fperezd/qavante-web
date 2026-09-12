import { describe, expect, it } from "vitest";
import { creditoInformado, gastosSobrePresupuesto, resumenCaja } from "./inicio-resumen-model";
import { BUDGET, DEFICIT, NO_DEFICIT, NOW } from "./inicio-resumen.fixtures";

describe("Inicio: cantidades canónicas y ausencia de datos", () => {
  it("no suma obligaciones a la brecha publicada ni reemplaza el mínimo por el cierre", () => {
    expect(resumenCaja(DEFICIT, NOW)).toMatchObject({
      gapAmount: 14_000_000,
      projected: -10_000_000,
      minimum: -14_000_000,
      needsAttention: true,
      noGapReported: false,
    });
  });
  it("mantiene el saldo publicado sin sumar cupos ni monedas", () => {
    expect(resumenCaja(DEFICIT, NOW).cash.monto).toBe(17_900_000);
  });
  it("null y números inválidos nunca se convierten en cero ni cobertura", () => {
    expect(resumenCaja(null, NOW)).toMatchObject({
      projected: null,
      minimum: null,
      noGapReported: false,
    });
    expect(
      resumenCaja({ ...NO_DEFICIT, cash_today: { ...NO_DEFICIT.cash_today!, total: "" } }, NOW)
        .noGapReported,
    ).toBe(false);
  });
  it("un cierre positivo no borra un faltante intermedio", () => {
    expect(
      resumenCaja(
        { ...DEFICIT, cash_gap: { ...DEFICIT.cash_gap!, projected_cash_14d: "5000000" } },
        NOW,
      ).needsAttention,
    ).toBe(true);
  });
  it("no presenta tranquilidad sobre fuentes incompletas, antiguas o contradictorias", () => {
    expect(resumenCaja(NO_DEFICIT, NOW).noGapReported).toBe(true);
    expect(resumenCaja({ ...NO_DEFICIT, cash_forecast: null }, NOW).noGapReported).toBe(false);
    expect(resumenCaja(NO_DEFICIT, new Date("2026-09-12T12:15:00Z")).noGapReported).toBe(false);
    expect(
      resumenCaja(
        { ...NO_DEFICIT, cash_today: { ...NO_DEFICIT.cash_today!, data_state: "stale" } },
        NOW,
      ).noGapReported,
    ).toBe(false);
    expect(
      resumenCaja(
        { ...NO_DEFICIT, cash_gap: { ...NO_DEFICIT.cash_gap!, cash_gap_amount_14d: "1" } },
        NOW,
      ).noGapReported,
    ).toBe(false);
  });
  it("brecha declarada sin monto permanece por confirmar, nunca $0", () => {
    expect(
      resumenCaja({ ...DEFICIT, cash_gap: { ...DEFICIT.cash_gap!, cash_gap_amount_14d: "0" } }, NOW)
        .gapAmount,
    ).toBeNull();
  });
});

describe("Inicio: sobrepresupuesto sin recalcular variaciones", () => {
  it("lee la variación signada del servidor", () => {
    expect(gastosSobrePresupuesto(BUDGET)).toEqual([
      {
        concept: "operating_expense",
        label: "los gastos",
        budget: 14_000_000,
        actual: 16_000_000,
        over: 2_000_000,
      },
    ]);
    expect(
      gastosSobrePresupuesto({
        ...BUDGET,
        lines: [{ ...BUDGET.lines![0]!, variance: "-1999999" }],
      })[0]?.over,
    ).toBe(1_999_999);
  });
  it("no compensa costos con gastos ni muestra ingresos como gasto", () => {
    expect(
      gastosSobrePresupuesto({
        ...BUDGET,
        lines: [
          ...BUDGET.lines!,
          {
            concept: "direct_cost",
            budget: "-5",
            actual: "-8",
            variance: "-3",
            variance_pct: "-60",
          },
          { concept: "revenue", budget: "20", actual: "10", variance: "-10", variance_pct: "-50" },
        ],
      }),
    ).toHaveLength(2);
  });
  it.each([
    { has_budget: false },
    { data_state: "partial" as const },
    { data_state: "estimated" as const },
    { missing_sources: ["sii"] },
    { lines: [] },
  ])("no afirma sobrepresupuesto con datos insuficientes: %j", (change) => {
    expect(gastosSobrePresupuesto({ ...BUDGET, ...change })).toEqual([]);
  });
  it("omite valores malformados o signos ajenos al contrato", () => {
    expect(
      gastosSobrePresupuesto({ ...BUDGET, lines: [{ ...BUDGET.lines![0]!, actual: "" }] }),
    ).toEqual([]);
    expect(
      gastosSobrePresupuesto({ ...BUDGET, lines: [{ ...BUDGET.lines![0]!, actual: "16000000" }] }),
    ).toEqual([]);
  });
});

describe("Inicio: cupo independiente de caja", () => {
  const balance = {
    montoAprobadoMonto: "6000000",
    montoAprobadoCodigoMoneda: "CLP",
    montoDisponibleMonto: "4000000",
    montoDisponibleCodigoMoneda: "CLP",
  };
  it("muestra disponible y cupo publicados", () =>
    expect(creditoInformado(balance)).toEqual({
      total: 6_000_000,
      available: 4_000_000,
      currency: "CLP",
    }));
  it("no infiere disponible ni moneda", () => {
    expect(creditoInformado({ ...balance, montoDisponibleMonto: null })?.available).toBeNull();
    expect(
      creditoInformado({ ...balance, montoDisponibleCodigoMoneda: "USD" })?.available,
    ).toBeNull();
    expect(creditoInformado({ ...balance, montoAprobadoCodigoMoneda: null })).toBeNull();
    expect(creditoInformado(undefined)).toBeNull();
  });
});
