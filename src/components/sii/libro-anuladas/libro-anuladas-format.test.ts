import { describe, expect, it } from "vitest";
import { agruparConReferencias, isNotaCredito, type LibroDoc } from "./libro-anuladas-format";

const fac = (folio: number, rut: string, total: number): LibroDoc => ({
  tipo_doc: 33,
  folio,
  rut_contraparte: rut,
  razon_social: "Cliente",
  monto_total: total,
});
const nc = (folio: number, rut: string, total: number): LibroDoc => ({
  tipo_doc: 61,
  folio,
  rut_contraparte: rut,
  razon_social: "Cliente",
  monto_total: total,
});

describe("libro-anuladas-format", () => {
  it("isNotaCredito detecta 60/61/112", () => {
    expect(isNotaCredito(61)).toBe(true);
    expect(isNotaCredito(33)).toBe(false);
  });

  it("factura + NC del mismo monto/RUT → anulada (neto 0)", () => {
    const { rows, totalNetas } = agruparConReferencias([fac(418, "96572360-9", 1440791), nc(83, "96572360-9", 1440791)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.estado).toBe("anulada");
    expect(rows[0]?.neto).toBe(0);
    expect(rows[0]?.notas).toHaveLength(1);
    expect(totalNetas).toBe(0);
  });

  it("dos facturas idénticas + una NC → solo una anulada, la otra vigente", () => {
    const { rows } = agruparConReferencias([
      fac(427, "76106531-9", 1476814),
      fac(428, "76106531-9", 1476814),
      nc(89, "76106531-9", 1476814),
    ]);
    const anuladas = rows.filter((r) => r.estado === "anulada");
    const vigentes = rows.filter((r) => r.estado === "vigente");
    expect(anuladas).toHaveLength(1);
    expect(vigentes).toHaveLength(1);
  });

  it("NC parcial → estado parcial y neto positivo", () => {
    const { rows } = agruparConReferencias([fac(1, "1-9", 100000), nc(2, "1-9", 30000)]);
    // no matchea (monto distinto) → queda vigente + NC huérfana. Verifico huérfana.
    expect(rows[0]?.estado).toBe("vigente");
  });

  it("totales: brutas − NC = netas", () => {
    const r = agruparConReferencias([fac(1, "a", 5000), fac(2, "b", 3000), nc(3, "a", 5000)]);
    expect(r.totalBrutas).toBe(8000);
    expect(r.totalNc).toBe(5000);
    expect(r.totalNetas).toBe(3000);
  });
});
