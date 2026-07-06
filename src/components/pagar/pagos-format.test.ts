import { describe, it, expect } from "vitest";
import { parseAmount, payableItemLabel, paymentCategoryLabel } from "./pagos-format";

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

describe("payableItemLabel", () => {
  it("payroll con clave natural → 'Remuneraciones — Mes Año'", () => {
    expect(
      payableItemLabel({
        label: "Remuneraciones — Doc 06",
        category: "payroll",
        source_external_id: "payroll-202606",
      }),
    ).toBe("Remuneraciones — Junio 2026");
  });

  it("payroll sin clave natural → respeta el label del backend", () => {
    expect(payableItemLabel({ label: "Remuneraciones — Doc 06", category: "payroll" })).toBe(
      "Remuneraciones — Doc 06",
    );
  });

  it("otras categorías → label del backend intacto", () => {
    expect(
      payableItemLabel({
        label: "Proveedor ACME",
        category: "supplier",
        source_external_id: "sii-123",
      }),
    ).toBe("Proveedor ACME");
  });
});
