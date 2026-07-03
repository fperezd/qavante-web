import { describe, expect, it } from "vitest";
import { agruparConReferencias, type AnulableDoc } from "./rcv-anuladas";

const fac = (folio: number, rut: string, total: number): AnulableDoc => ({
  tipo_doc: 33,
  folio,
  rut_contraparte: rut,
  razon_social: "Cliente",
  monto_total: total,
});
const nc = (folio: number, rut: string, total: number): AnulableDoc => ({
  tipo_doc: 61,
  folio,
  rut_contraparte: rut,
  razon_social: "Cliente",
  monto_total: total,
});
/** NC con referencia exacta al DTE (ref_tipo_doc 33 = factura por defecto). */
const ncRef = (folio: number, rut: string, total: number, refFolio: number, refTipo = 33): AnulableDoc => ({
  ...nc(folio, rut, total),
  ref_tipo_doc: refTipo,
  ref_folio: refFolio,
});

describe("rcv-anuladas · agruparConReferencias", () => {
  it("factura + NC del mismo monto/RUT → anulada (neto 0)", () => {
    const { rows, totalNetas } = agruparConReferencias([fac(418, "96572360-9", 1440791), nc(83, "96572360-9", 1440791)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.estado).toBe("anulada");
    expect(rows[0]?.neto).toBe(0);
    expect(rows[0]?.notas).toHaveLength(1);
    expect(totalNetas).toBe(0);
  });

  it("ref exacta: NC apunta a la factura por ref_folio, no por monto", () => {
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

  it("ref exacta linkea aunque el monto de la NC difiera (heurística no lo haría)", () => {
    const { rows, notasHuerfanas } = agruparConReferencias([fac(500, "9-9", 1000000), ncRef(90, "9-9", 999999, 500)]);
    expect(notasHuerfanas).toHaveLength(0);
    expect(rows[0]?.estado).toBe("parcial");
    expect(rows[0]?.neto).toBe(1);
    expect(rows[0]?.matchExacto).toBe(true);
  });

  it("NC heurística (sin ref) marca matchExacto=false", () => {
    const { rows } = agruparConReferencias([fac(1, "a", 5000), nc(3, "a", 5000)]);
    expect(rows[0]?.estado).toBe("anulada");
    expect(rows[0]?.matchExacto).toBe(false);
  });

  it("NC sin factura → nota huérfana", () => {
    const { rows, notasHuerfanas } = agruparConReferencias([fac(1, "a", 5000), nc(9, "b", 3000)]);
    expect(rows[0]?.estado).toBe("vigente");
    expect(notasHuerfanas).toHaveLength(1);
    expect(notasHuerfanas[0]?.folio).toBe(9);
  });

  it("sobre-crédito: 3 NC (ref) sobre 1 factura → anulada + sobreCredito, neto<0 (caso Kaufmann real)", () => {
    const { rows } = agruparConReferencias([
      fac(417, "96572360-9", 1440791),
      fac(416, "96572360-9", 1440791), // misma plata, SIN NC → queda vigente
      ncRef(81, "96572360-9", 1440791, 417),
      ncRef(84, "96572360-9", 1440791, 417),
      ncRef(88, "96572360-9", 1440791, 417),
    ]);
    const r417 = rows.find((r) => r.factura.folio === 417);
    const r416 = rows.find((r) => r.factura.folio === 416);
    expect(r417?.notas).toHaveLength(3);
    expect(r417?.estado).toBe("anulada");
    expect(r417?.sobreCredito).toBe(true);
    expect(r417?.neto).toBeLessThan(0);
    // La 416 NO recibe NC (todas ref a 417) → sigue vigente, sin sobreCredito.
    expect(r416?.estado).toBe("vigente");
    expect(r416?.sobreCredito).toBe(false);
  });

  it("anulación exacta no marca sobreCredito", () => {
    const { rows } = agruparConReferencias([fac(415, "9", 1260693), ncRef(80, "9", 1260693, 415)]);
    expect(rows[0]?.estado).toBe("anulada");
    expect(rows[0]?.sobreCredito).toBe(false);
    expect(rows[0]?.neto).toBe(0);
  });

  it("robusto al signo: NC con monto negativo igual RESTA (magnitud)", () => {
    // Algunos fixtures traen la NC en negativo; el neto debe bajar, no subir.
    const ncNeg: AnulableDoc = { ...nc(9, "a", -5000), ref_tipo_doc: 33, ref_folio: 1 };
    const { rows, totalNetas, totalNc } = agruparConReferencias([fac(1, "a", 5000), ncNeg]);
    expect(rows[0]?.estado).toBe("anulada");
    expect(rows[0]?.neto).toBe(0);
    expect(totalNc).toBe(5000);
    expect(totalNetas).toBe(0);
  });

  it("totales: brutas − NC = netas", () => {
    const r = agruparConReferencias([fac(1, "a", 5000), fac(2, "b", 3000), nc(3, "a", 5000)]);
    expect(r.totalBrutas).toBe(8000);
    expect(r.totalNc).toBe(5000);
    expect(r.totalNetas).toBe(3000);
  });

  it("tolera montos null sin romper", () => {
    const { rows } = agruparConReferencias([{ tipo_doc: 33, folio: 1 }, { tipo_doc: 61, folio: 2 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.neto).toBe(0);
  });
});
