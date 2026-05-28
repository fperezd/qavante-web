/* Tests del data layer treasury-reports. Cubre query key stability y el
   helper de default range. No toca MSW: agregar handler de cash-flow es
   trabajo de un PR siguiente (Sprint C3 wave 2) cuando agreguemos fixtures. */
import { describe, expect, it } from "vitest";
import { defaultCashFlowRange, treasuryReportsKeys } from "./treasury-reports";

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
  it("from = mes del 'now'; to = mes + 3 (≈13 semanas con granularity=week)", () => {
    const r = defaultCashFlowRange(new Date(2026, 4, 27)); // 2026-05-27 (mes 0-based)
    expect(r.period_from).toBe("2026-05");
    expect(r.period_to).toBe("2026-08");
  });

  it("rollover de año cuando from está cerca de fin de año", () => {
    const r = defaultCashFlowRange(new Date(2026, 10, 1)); // 2026-11
    expect(r.period_from).toBe("2026-11");
    expect(r.period_to).toBe("2027-02");
  });

  it("rollover de año en el extremo de diciembre", () => {
    const r = defaultCashFlowRange(new Date(2026, 11, 31)); // 2026-12
    expect(r.period_from).toBe("2026-12");
    expect(r.period_to).toBe("2027-03");
  });

  it("pads months con cero a la izquierda", () => {
    const r = defaultCashFlowRange(new Date(2026, 0, 15)); // 2026-01
    expect(r.period_from).toBe("2026-01");
    expect(r.period_to).toBe("2026-04");
  });
});
