import { describe, it, expect } from "vitest";
import {
  montoCLP,
  montoCLPFaltante,
  multiCurrencyNote,
  parseAmount,
  payableItemLabel,
  paymentCategoryLabel,
} from "./pagos-format";
import type { PayableItem } from "@/lib/api/pagos";

const item = (over: Partial<PayableItem>): PayableItem =>
  ({ label: "x", category: "supplier", amount: "0", currency: "CLP", amount_clp: null, ...over }) as PayableItem;

describe("montoCLP", () => {
  it("CLP con amount_clp presente: usa amount_clp", () => {
    expect(montoCLP(item({ currency: "CLP", amount: "50000", amount_clp: "50000" }))).toBe(50_000);
  });
  it("CLP con amount_clp null: cae a amount", () => {
    expect(montoCLP(item({ currency: "CLP", amount: "50000", amount_clp: null }))).toBe(50_000);
  });
  it("CLP con amount_clp='' (blanco, no null): cae a amount, no a 0 (regresión)", () => {
    // `??` no trata "" como ausente → parseAmount("")=0 subestimaba el total. Ahora cae a `amount`.
    expect(montoCLP(item({ currency: "CLP", amount: "50000", amount_clp: "" }))).toBe(50_000);
  });
  it("extranjera con amount_clp: usa el convertido", () => {
    expect(montoCLP(item({ currency: "USD", amount: "1240", amount_clp: "1190000" }))).toBe(1_190_000);
  });
  it("extranjera SIN amount_clp (null o ''): aporta 0 (no inventa el nominal como CLP)", () => {
    expect(montoCLP(item({ currency: "USD", amount: "1240", amount_clp: null }))).toBe(0);
    expect(montoCLP(item({ currency: "USD", amount: "1240", amount_clp: "" }))).toBe(0);
    expect(montoCLPFaltante(item({ currency: "USD", amount: "1240", amount_clp: "" }))).toBe(true);
  });
});

describe("multiCurrencyNote", () => {
  it("null con 0 o 1 moneda (no hay nada que desglosar)", () => {
    expect(multiCurrencyNote(undefined)).toBeNull();
    expect(multiCurrencyNote([])).toBeNull();
    expect(multiCurrencyNote([{ currency: "CLP", amount: "1000" }])).toBeNull();
  });

  it("desglosa CLP + USD con símbolo y código", () => {
    const note = multiCurrencyNote([
      { currency: "CLP", amount: "12800000" },
      { currency: "USD", amount: "2400.5" },
    ]);
    expect(note).toContain("(CLP)");
    expect(note).toContain("(USD)");
    expect(note).toContain(" + ");
  });

  it("tolera moneda vacía cayendo a CLP", () => {
    expect(
      multiCurrencyNote([
        { currency: "", amount: "100" },
        { currency: "USD", amount: "5" },
      ]),
    ).toContain("(CLP)");
  });
});

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
