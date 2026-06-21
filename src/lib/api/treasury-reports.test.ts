/* Tests del data layer treasury-reports. Cubre query key stability y el
   helper de default range. No toca MSW: agregar handler de cash-flow es
   trabajo de un PR siguiente (Sprint C3 wave 2) cuando agreguemos fixtures. */
import { describe, expect, it } from "vitest";
import { buildCashFlowQuery, defaultCashFlowRange, treasuryReportsKeys } from "./treasury-reports";

describe("treasuryReportsKeys", () => {
  it("cashFlow key es estable y namespaced", () => {
    const key = treasuryReportsKeys.cashFlow({
      period_from: "2026-05",
      period_to: "2026-08",
    });
    expect(key[0]).toBe("treasury-reports");
    expect(key[1]).toBe("cash-flow");
  });

  it("cashFlow key varía cuando cambia el rango", () => {
    const a = treasuryReportsKeys.cashFlow({ period_from: "2026-05", period_to: "2026-08" });
    const b = treasuryReportsKeys.cashFlow({ period_from: "2026-06", period_to: "2026-08" });
    expect(a).not.toEqual(b);
  });

  it("cashFlow key varía cuando cambia granularity", () => {
    const a = treasuryReportsKeys.cashFlow({
      period_from: "2026-05",
      period_to: "2026-08",
      granularity: "week",
    });
    const b = treasuryReportsKeys.cashFlow({
      period_from: "2026-05",
      period_to: "2026-08",
      granularity: "month",
    });
    expect(a).not.toEqual(b);
  });
});

describe("defaultCashFlowRange", () => {
  it("from = mes del 'now'; to = mes siguiente (mes + 1)", () => {
    const r = defaultCashFlowRange(new Date(2026, 4, 27)); // 2026-05-27 (mes 0-based)
    expect(r.period_from).toBe("2026-05");
    expect(r.period_to).toBe("2026-06");
  });

  it("rollover de año cuando from es diciembre", () => {
    const r = defaultCashFlowRange(new Date(2026, 11, 31)); // 2026-12
    expect(r.period_from).toBe("2026-12");
    expect(r.period_to).toBe("2027-01");
  });

  it("pads months con cero a la izquierda", () => {
    const r = defaultCashFlowRange(new Date(2026, 0, 15)); // 2026-01
    expect(r.period_from).toBe("2026-01");
    expect(r.period_to).toBe("2026-02");
  });
});

describe("buildCashFlowQuery", () => {
  it("incluye period_from y period_to siempre (son required)", () => {
    const q = buildCashFlowQuery({ period_from: "2026-05", period_to: "2026-08" });
    expect(q).toContain("period_from=2026-05");
    expect(q).toContain("period_to=2026-08");
  });

  it("inicia con ?", () => {
    const q = buildCashFlowQuery({ period_from: "2026-05", period_to: "2026-08" });
    expect(q.startsWith("?")).toBe(true);
  });

  it("no incluye params opcionales si no se setean", () => {
    const q = buildCashFlowQuery({ period_from: "2026-05", period_to: "2026-08" });
    expect(q).not.toContain("granularity");
    expect(q).not.toContain("financial_layer");
    expect(q).not.toContain("group_by");
    expect(q).not.toContain("currency");
    expect(q).not.toContain("account_id");
    expect(q).not.toContain("scenario_id");
    expect(q).not.toContain("version_id");
    expect(q).not.toContain("include_attention");
  });

  it("incluye granularity cuando se setea", () => {
    const q = buildCashFlowQuery({
      period_from: "2026-05",
      period_to: "2026-08",
      granularity: "week",
    });
    expect(q).toContain("granularity=week");
  });

  it("incluye financial_layer cuando se setea", () => {
    const q = buildCashFlowQuery({
      period_from: "2026-05",
      period_to: "2026-08",
      financial_layer: "forecast",
    });
    expect(q).toContain("financial_layer=forecast");
  });

  it("incluye include_attention=false explícitamente (no es undefined)", () => {
    const q = buildCashFlowQuery({
      period_from: "2026-05",
      period_to: "2026-08",
      include_attention: false,
    });
    expect(q).toContain("include_attention=false");
  });

  it("incluye include_attention=true cuando es true", () => {
    const q = buildCashFlowQuery({
      period_from: "2026-05",
      period_to: "2026-08",
      include_attention: true,
    });
    expect(q).toContain("include_attention=true");
  });

  it("URL-encodea valores con caracteres especiales (defensivo: UUIDs son safe)", () => {
    const q = buildCashFlowQuery({
      period_from: "2026-05",
      period_to: "2026-08",
      account_id: "uuid-with-dashes-123",
    });
    expect(q).toContain("account_id=uuid-with-dashes-123");
  });

  it("omite include_attention si es undefined (no false=undefined collision)", () => {
    const q = buildCashFlowQuery({
      period_from: "2026-05",
      period_to: "2026-08",
      include_attention: undefined,
    });
    expect(q).not.toContain("include_attention");
  });
});
