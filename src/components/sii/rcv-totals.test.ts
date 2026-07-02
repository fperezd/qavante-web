import { describe, expect, it } from "vitest";
import { computeRcvTotals, type RcvDocLike } from "./rcv-totals";

const fac = (total: number): RcvDocLike => ({ tipo_doc: 33, monto_neto: total / 1.19, monto_iva: total - total / 1.19, monto_total: total });
const nc = (total: number): RcvDocLike => ({ tipo_doc: 61, monto_total: total, monto_neto: total, monto_iva: 0 });
const nd = (total: number): RcvDocLike => ({ tipo_doc: 56, monto_total: total, monto_neto: total, monto_iva: 0 });

describe("computeRcvTotals — neteo de notas de crédito", () => {
  it("NC POSITIVA (convención A) → resta del total", () => {
    // 2 facturas de 1.000.000 + 1 NC de 300.000 → neto 1.700.000
    const t = computeRcvTotals([fac(1000000), fac(1000000), nc(300000)]);
    expect(t.total).toBe(1700000);
    expect(t.grossTotal).toBe(2000000);
    expect(t.ncTotal).toBe(300000);
    expect(t.ncCount).toBe(1);
  });

  it("NC NEGATIVA (convención B, como el fixture del SII) → también resta", () => {
    // misma situación pero la NC llega con monto negativo → debe dar el MISMO neto
    const t = computeRcvTotals([fac(1000000), fac(1000000), nc(-300000)]);
    expect(t.total).toBe(1700000);
    expect(t.ncTotal).toBe(300000); // magnitud
  });

  it("Nota de DÉBITO (56) SUMA, no resta", () => {
    const t = computeRcvTotals([fac(1000000), nd(200000)]);
    expect(t.total).toBe(1200000);
    expect(t.ncCount).toBe(0);
  });

  it("factura anulada por NC de igual monto → neto 0", () => {
    const t = computeRcvTotals([fac(1440791), nc(1440791)]);
    expect(t.total).toBe(0);
  });

  it("tolera montos nulos/no-numéricos", () => {
    const t = computeRcvTotals([{ tipo_doc: 33 }, { tipo_doc: 61, monto_total: undefined }]);
    expect(t.total).toBe(0);
  });
});
