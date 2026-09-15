import { describe, expect, it } from "vitest";
import { agruparConReferencias, agruparVisibleConContexto, type AnulableDoc } from "./rcv-anuladas";

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
const ncRef = (
  folio: number,
  rut: string,
  total: number,
  refFolio: number,
  refTipo = 33,
): AnulableDoc => ({
  ...nc(folio, rut, total),
  ref_tipo_doc: refTipo,
  ref_folio: refFolio,
});

describe("rcv-anuladas · agruparConReferencias", () => {
  it("RUT+monto sólo propone asociación y no modifica la factura", () => {
    const { rows, totalNetas, notasHuerfanas, asociacionesPendientes } = agruparConReferencias([
      fac(418, "96572360-9", 1440791),
      nc(83, "96572360-9", 1440791),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.estado).toBe("vigente");
    expect(rows[0]?.neto).toBe(1440791);
    expect(rows[0]?.notas).toHaveLength(0);
    expect(notasHuerfanas).toHaveLength(1);
    expect(asociacionesPendientes[0]).toMatchObject({
      status: "possible_association",
      candidateFolios: [418],
      reason: "unique_rut_amount_match",
    });
    expect(totalNetas).toBe(0);
  });

  it("ref legacy identifica candidato pero sin CodRef no afirma efecto fiscal", () => {
    const { rows, asociacionesPendientes } = agruparConReferencias([
      fac(427, "76106531-9", 1476814),
      fac(428, "76106531-9", 1476814),
      ncRef(89, "76106531-9", 1476814, 428),
    ]);
    expect(rows.every((row) => row.estado === "vigente" && row.notas.length === 0)).toBe(true);
    expect(asociacionesPendientes[0]).toMatchObject({
      status: "reference_effect_unknown",
      candidateFolios: [428],
      reason: "legacy_reference_without_fiscal_effect",
    });
  });

  it("ref legacy con monto distinto tampoco altera la factura", () => {
    const { rows, notasHuerfanas, asociacionesPendientes } = agruparConReferencias([
      fac(500, "9-9", 1000000),
      ncRef(90, "9-9", 999999, 500),
    ]);
    expect(notasHuerfanas).toHaveLength(1);
    expect(rows[0]?.estado).toBe("vigente");
    expect(rows[0]?.neto).toBe(1000000);
    expect(asociacionesPendientes[0]?.status).toBe("reference_effect_unknown");
  });

  it("ref legacy con folio duplicado queda ambigua y no elige una factura", () => {
    const { rows, asociacionesPendientes } = agruparConReferencias([
      fac(500, "9-9", 1000000),
      fac(500, "9-9", 1000000),
      ncRef(90, "9-9", 1000000, 500),
    ]);
    expect(rows.every((row) => row.estado === "vigente" && row.notas.length === 0)).toBe(true);
    expect(asociacionesPendientes[0]).toMatchObject({
      status: "ambiguous",
      candidateFolios: [500, 500],
      reason: "multiple_candidates",
    });
  });

  it("dos candidatos por RUT+monto quedan ambiguos y ninguno se elige", () => {
    const { rows, asociacionesPendientes } = agruparConReferencias([
      fac(1, "a", 5000),
      fac(2, "a", 5000),
      nc(3, "a", 5000),
    ]);
    expect(rows.every((row) => row.estado === "vigente" && row.neto === 5000)).toBe(true);
    expect(asociacionesPendientes[0]).toMatchObject({
      status: "ambiguous",
      candidateFolios: [1, 2],
      reason: "multiple_candidates",
    });
  });

  it("un filtro visual no degrada una asociación ambigua a posible", () => {
    const facturaVisible = fac(1, "a", 5000);
    const facturaOculta = fac(2, "a", 5000);
    const nota = nc(3, "a", 5000);
    const { rows, asociacionesPendientes } = agruparVisibleConContexto(
      [facturaVisible, facturaOculta, nota],
      [facturaVisible, nota],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.factura).toBe(facturaVisible);
    expect(asociacionesPendientes[0]).toMatchObject({
      nota,
      status: "ambiguous",
      candidateFolios: [1, 2],
      reason: "multiple_candidates",
    });
  });

  it("NC sin factura → nota huérfana", () => {
    const { rows, notasHuerfanas } = agruparConReferencias([fac(1, "a", 5000), nc(9, "b", 3000)]);
    expect(rows[0]?.estado).toBe("vigente");
    expect(notasHuerfanas).toHaveLength(1);
    expect(notasHuerfanas[0]?.folio).toBe(9);
  });

  it("tres NC legacy sobre un folio no producen sobre-crédito ni anulación", () => {
    const { rows, asociacionesPendientes } = agruparConReferencias([
      fac(417, "96572360-9", 1440791),
      fac(416, "96572360-9", 1440791), // misma plata, SIN NC → queda vigente
      ncRef(81, "96572360-9", 1440791, 417),
      ncRef(84, "96572360-9", 1440791, 417),
      ncRef(88, "96572360-9", 1440791, 417),
    ]);
    const r417 = rows.find((r) => r.factura.folio === 417);
    const r416 = rows.find((r) => r.factura.folio === 416);
    expect(r417?.notas).toHaveLength(0);
    expect(r417?.estado).toBe("vigente");
    expect(r417?.sobreCredito).toBe(false);
    expect(r417?.neto).toBe(1440791);
    expect(r416?.estado).toBe("vigente");
    expect(r416?.sobreCredito).toBe(false);
    expect(asociacionesPendientes).toHaveLength(3);
    expect(
      asociacionesPendientes.every(
        (association) =>
          association.status === "reference_effect_unknown" &&
          association.candidateFolios[0] === 417,
      ),
    ).toBe(true);
  });

  it("una referencia legacy de monto exacto conserva la factura vigente", () => {
    const { rows } = agruparConReferencias([fac(415, "9", 1260693), ncRef(80, "9", 1260693, 415)]);
    expect(rows[0]?.estado).toBe("vigente");
    expect(rows[0]?.sobreCredito).toBe(false);
    expect(rows[0]?.neto).toBe(1260693);
  });

  it("una NC negativa sólo genera una asociación posible por magnitud", () => {
    const { rows, notasHuerfanas, asociacionesPendientes } = agruparConReferencias([
      fac(1, "a", 5000),
      nc(9, "a", -5000),
    ]);
    expect(rows[0]?.estado).toBe("vigente");
    expect(rows[0]?.neto).toBe(5000);
    expect(notasHuerfanas).toHaveLength(1);
    expect(asociacionesPendientes[0]?.status).toBe("possible_association");
  });

  it("robusto al signo: NC con monto negativo igual RESTA (magnitud)", () => {
    // Algunos fixtures traen la NC en negativo; el neto debe bajar, no subir.
    const ncNeg: AnulableDoc = { ...nc(9, "a", -5000), ref_tipo_doc: 33, ref_folio: 1 };
    const { rows, totalNetas, totalNc } = agruparConReferencias([fac(1, "a", 5000), ncNeg]);
    expect(rows[0]?.estado).toBe("vigente");
    expect(rows[0]?.neto).toBe(5000);
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
    const { rows, asociacionesPendientes } = agruparConReferencias([
      { tipo_doc: 33, folio: 1 },
      { tipo_doc: 61, folio: 2 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.neto).toBe(0);
    expect(asociacionesPendientes[0]?.status).toBe("unresolved");
  });
});
