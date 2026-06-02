import { describe, it, expect } from "vitest";
import { parseAmount, paymentCategoryLabel, criticalFirst } from "./pagos-format";
import type { PayableItem } from "@/lib/api/pagos";

describe("parseAmount", () => {
  it("string-decimal → number; vacío/inválido → 0", () => {
    expect(parseAmount("4200000")).toBe(4200000);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("x")).toBe(0);
  });
});

describe("paymentCategoryLabel", () => {
  it("mapea categorías conocidas", () => {
    expect(paymentCategoryLabel("tax")).toBe("Impuestos");
    expect(paymentCategoryLabel("payroll")).toBe("Sueldos");
    expect(paymentCategoryLabel("supplier")).toBe("Proveedor");
  });
  it("desconocida → 'Otro'", () => {
    expect(paymentCategoryLabel("loquesea")).toBe("Otro");
  });
});

describe("criticalFirst", () => {
  function item(p: Partial<PayableItem> & { label: string }): PayableItem {
    return {
      category: "supplier",
      due_date: "2026-06-15",
      amount: "1000000",
      criticality: "low",
      source: "Manual",
      ...p,
    };
  }

  it("críticos primero, luego por fecha asc; no muta el input", () => {
    const input = [
      item({ label: "C", criticality: "low", due_date: "2026-06-01" }),
      item({ label: "A", criticality: "high", due_date: "2026-06-20" }),
      item({ label: "B", criticality: "high", due_date: "2026-06-05" }),
      item({ label: "D", criticality: "medium", due_date: "2026-06-10" }),
    ];
    const snapshot = [...input];
    const out = criticalFirst(input);
    expect(out.map((i) => i.label)).toEqual(["B", "A", "D", "C"]);
    expect(input).toEqual(snapshot); // input intacto
  });
});
