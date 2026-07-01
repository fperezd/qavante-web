import { describe, expect, it } from "vitest";
import {
  cashDelta14d,
  criticalityTone,
  dueBucket,
  groupBySupplier,
  subtotalsByCriticality,
  type PagoItem,
} from "./pagar-v2-format";

const item = (over: Partial<PagoItem>): PagoItem => ({
  label: "Pago",
  supplier: "Proveedor X",
  category: "proveedor",
  amount: "1000000",
  days_to_due: 5,
  criticality: "media",
  due_date: "2026-07-10",
  ...over,
});

describe("pagar-v2-format", () => {
  it("dueBucket clasifica por días al vencimiento", () => {
    expect(dueBucket(-3)).toBe("vencido");
    expect(dueBucket(5)).toBe("d7");
    expect(dueBucket(12)).toBe("d14");
    expect(dueBucket(25)).toBe("d30");
    expect(dueBucket(60)).toBe("mas");
  });

  it("criticalityTone mapea los 3 niveles", () => {
    expect(criticalityTone("critica")).toEqual({ tone: "danger", label: "Crítico" });
    expect(criticalityTone("media").tone).toBe("warning");
    expect(criticalityTone("baja").label).toBe("Bajo");
  });

  it("cashDelta14d = caja proyectada − obligaciones críticas", () => {
    expect(cashDelta14d("5000000", "7300000")).toBe(-2300000);
    expect(cashDelta14d("8000000", "3000000")).toBe(5000000);
  });

  it("subtotalsByCriticality suma por nivel", () => {
    const totals = subtotalsByCriticality([
      item({ criticality: "critica", amount: "3000000" }),
      item({ criticality: "critica", amount: "1000000" }),
      item({ criticality: "baja", amount: "500000" }),
    ]);
    expect(totals).toEqual({ critica: 4000000, media: 0, baja: 500000 });
  });

  it("groupBySupplier agrupa y ordena desc", () => {
    const groups = groupBySupplier([
      item({ supplier: "A", amount: "1000000" }),
      item({ supplier: "B", amount: "5000000" }),
      item({ supplier: "A", amount: "2000000" }),
    ]);
    expect(groups[0]).toEqual({ supplier: "B", total: 5000000, count: 1 });
    expect(groups[1]).toEqual({ supplier: "A", total: 3000000, count: 2 });
  });
});
