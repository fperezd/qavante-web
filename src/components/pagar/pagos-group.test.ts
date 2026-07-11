import { describe, it, expect } from "vitest";
import {
  groupByCategory,
  categoryGroupLabel,
  shareOfTotal,
  payrollPeriodFromExternalId,
} from "./pagos-group";
import type { PayableItem } from "@/lib/api/pagos";

const item = (category: PayableItem["category"], amount: string): PayableItem =>
  ({ label: "x", category, due_date: "2026-07-10", amount, criticality: "medium", source: "SII", currency: "CLP" }) as PayableItem;

describe("groupByCategory", () => {
  it("agrupa por categoría y ordena por subtotal desc", () => {
    const groups = groupByCategory([
      item("supplier", "1000000"),
      item("payroll", "5000000"),
      item("supplier", "2000000"),
      item("tax", "500000"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["payroll", "supplier", "tax"]);
    expect(groups[0]?.subtotal).toBe(5000000);
    expect(groups[1]?.subtotal).toBe(3000000);
    expect(groups[1]?.items.length).toBe(2);
  });

  it("categoryGroupLabel: etiquetas plurales por categoría", () => {
    expect(categoryGroupLabel("supplier")).toBe("Proveedores");
    expect(categoryGroupLabel("payroll")).toBe("Remuneraciones");
    expect(categoryGroupLabel("desconocida")).toBe("Otros");
  });

  it("shareOfTotal: % del total, guard división por cero", () => {
    expect(shareOfTotal(30, 100)).toBe(30);
    expect(shareOfTotal(10, 0)).toBe(0);
  });

  it("payrollPeriodFromExternalId: 'payroll-YYYYMM' → 'YYYY-MM'", () => {
    expect(payrollPeriodFromExternalId("payroll-202606")).toBe("2026-06");
    expect(payrollPeriodFromExternalId("otra-cosa")).toBeNull();
    expect(payrollPeriodFromExternalId(null)).toBeNull();
  });
});
