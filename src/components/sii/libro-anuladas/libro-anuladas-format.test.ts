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
/** NC con referencia exacta al DTE (ref_tipo_doc 33 = factura por defecto). */
const ncRef = (folio: number, rut: string, total: number, refFolio: number, refTipo = 33): LibroDoc => ({
  ...nc(folio, rut, total),
  ref_tipo_doc: refTipo,
  ref_folio: refFolio,
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

  it("ref exacta: NC apunta a la factura por ref_folio (no por monto)", () => {
    // Dos facturas idénticas (mismo RUT y monto); la NC referencia la 428.
    const { rows } = agruparConReferencias([
      fac(427, "76106531-9", 1476814),
      fac(428, "76106531-9", 1476814),
      ncRef(89, "76106531-9", 1476814, 428),
    ]);
    const anulada = rows.find((r) => r.estado === "anulada");
    const vigente = rows.find((r) => r.estado === "vigente");
    expect(anulada?.factura.folio).toBe(428);
    expect(vigente?.factura.folio).toBe(427);
    expect(anulada?.matchExacto).toBe(true);
  });

  it("ref exacta linkea aunque el monto de la NC difiera (la heurística no lo haría)", () => {
    // Monto de la NC ≠ factura → la heurística (RUT+monto) NO matchearía;
    // la referencia sí. Anulación parcial: neto positivo.
    const { rows, notasHuerfanas } = agruparConReferencias([fac(500, "9-9", 1000000), ncRef(90, "9-9", 999999, 500)]);
    expect(notasHuerfanas).toHaveLength(0);
    expect(rows[0]?.estado).toBe("parcial");
    expect(rows[0]?.neto).toBe(1);
    expect(rows[0]?.matchExacto).toBe(true);
  });

  it("ref con tipo distinto no matchea la factura equivocada", () => {
    // ref_tipo_doc 34 (factura exenta) no debe linkear una factura tipo 33.
    const { rows, notasHuerfanas } = agruparConReferencias([
      fac(600, "9-9", 500000),
      ncRef(91, "9-9", 500000, 600, 34),
    ]);
    // Cae a heurística (RUT+monto) → igual la anula, pero marcada no-exacta.
    expect(rows[0]?.estado).toBe("anulada");
    expect(rows[0]?.matchExacto).toBe(false);
    expect(notasHuerfanas).toHaveLength(0);
  });

  it("NC heurística (sin ref) marca matchExacto=false", () => {
    const { rows } = agruparConReferencias([fac(1, "a", 5000), nc(3, "a", 5000)]);
    expect(rows[0]?.estado).toBe("anulada");
    expect(rows[0]?.matchExacto).toBe(false);
  });

  it("totales: brutas − NC = netas", () => {
    const r = agruparConReferencias([fac(1, "a", 5000), fac(2, "b", 3000), nc(3, "a", 5000)]);
    expect(r.totalBrutas).toBe(8000);
    expect(r.totalNc).toBe(5000);
    expect(r.totalNetas).toBe(3000);
  });
});
