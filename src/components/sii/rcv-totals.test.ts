import { describe, expect, it } from "vitest";
import { computeRcvTotals, type RcvDocLike } from "./rcv-totals";

const fac = (total: number): RcvDocLike => ({
  tipo_doc: 33,
  complete: true,
  neto_afecto: total,
  exento: 0,
  iva: 0,
  otros_ajustes_residual: 0,
  total,
});
const nc = (total: number): RcvDocLike => ({
  tipo_doc: 61,
  complete: true,
  neto_afecto: total,
  exento: 0,
  iva: 0,
  otros_ajustes_residual: 0,
  total,
});
const nd = (total: number): RcvDocLike => ({
  tipo_doc: 56,
  complete: true,
  neto_afecto: total,
  exento: 0,
  iva: 0,
  otros_ajustes_residual: 0,
  total,
});

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

  it("un documento sin bridge no fabrica montos", () => {
    const t = computeRcvTotals([{ tipo_doc: 33 }, { tipo_doc: 61 }]);
    expect(t.total).toBeNull();
  });

  it("suma el exento por separado (exportaciones tipo 110), neteando NC", () => {
    const t = computeRcvTotals([
      {
        tipo_doc: 33,
        complete: true,
        neto_afecto: 1000,
        exento: 0,
        iva: 0,
        otros_ajustes_residual: 0,
        total: 1000,
      },
      {
        tipo_doc: 110,
        complete: true,
        neto_afecto: 0,
        exento: 5000,
        iva: 0,
        otros_ajustes_residual: 0,
        total: 5000,
      },
      {
        tipo_doc: 61,
        complete: true,
        neto_afecto: 0,
        exento: 500,
        iva: 0,
        otros_ajustes_residual: 0,
        total: 500,
      },
    ]);
    expect(t.neto).toBe(1000); // afecto no cambia
    expect(t.exento).toBe(4500); // 5000 − 500
  });

  it("no afirma desglose canónico cuando falta el bridge", () => {
    const t = computeRcvTotals([{ tipo_doc: 33, complete: false }]);
    expect(t.neto).toBeNull();
    expect(t.exento).toBeNull();
    expect(t.iva).toBeNull();
    expect(t.total).toBeNull();
    expect(t.grossTotal).toBeNull();
    expect(t.ncTotal).toBeNull();
    expect(t.breakdown).toBeNull();
    expect(t.incompleteCount).toBe(1);
  });

  it("usa el bridge canónico, conserva ceros y netea NC/ND sin recalcular residual", () => {
    const t = computeRcvTotals([
      {
        tipo_doc: 33,
        complete: true,
        neto_afecto: 1247820,
        exento: 113342,
        iva: 237086,
        otros_ajustes_residual: 0,
        total: 1598248,
      },
      {
        tipo_doc: 61,
        complete: true,
        neto_afecto: 100,
        exento: 0,
        iva: 19,
        otros_ajustes_residual: 1,
        total: 120,
      },
      {
        tipo_doc: 56,
        complete: true,
        neto_afecto: 20,
        exento: 0,
        iva: 4,
        otros_ajustes_residual: 0,
        total: 24,
      },
    ]);
    expect(t.breakdown).toEqual({
      netoAfecto: 1247740,
      exento: 113342,
      iva: 237071,
      otrosAjustes: -1,
      total: 1598152,
      netoSinIva: 1361082,
    });
  });

  it("un null o campo faltante deja el total del filtro como cobertura incompleta", () => {
    const t = computeRcvTotals([
      {
        tipo_doc: 33,
        complete: true,
        neto_afecto: 0,
        exento: 0,
        iva: 0,
        otros_ajustes_residual: 0,
        total: 0,
      },
      {
        tipo_doc: 33,
        complete: false,
        neto_afecto: null,
        exento: 0,
        iva: 0,
        total: 0,
        missing_components: ["neto_afecto:null"],
      },
    ]);
    expect(t.breakdown).toBeNull();
    expect(t.incompleteCount).toBe(1);
  });
});
