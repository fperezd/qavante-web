import { describe, expect, it } from "vitest";
import { agruparConReferencias, type AnulableDoc } from "./rcv-anuladas";
import { computeRcvTotals } from "./rcv-totals";

/* Regresión con DATOS REALES del SII (no fixtures ideales). Estos casos salieron
 * de payloads reales verificados en prod (cookie Tooxs) que rompieron supuestos:
 *
 *  1. Ventas Kaufmann Junio 2026: 8 facturas + 5 NC, con 3 NC apuntando por
 *     `ref_folio` a la MISMA factura 417 (sobre-crédito real del emisor). El
 *     total del período debe seguir siendo brutas − Σ|NC| (Opción A, fiel al
 *     SII), y el neto de la 417 no debe mostrarse negativo.
 *  2. Compras: el slim llega con `tipo_doc: null` → no se detecta NC, todo se
 *     trata como documento suelto (comportamiento inerte, no debe romper).
 *  3. NC del SII vienen en POSITIVO (los fixtures ideales las tenían negativas).
 *
 * Si el CI hubiera tenido estos casos, los 2 bugs que encontró Fernando (neto
 * negativo + "DOC" en Compras) se habrían visto acá primero. */

/** Ventas Kaufmann, Junio 2026 — copia literal del dump de producción
 *  (RUT 96572360-9). NC en positivo, como las manda el SII. */
const KAUFMANN_JUNIO: AnulableDoc[] = [
  { tipo_doc: 33, folio: 424, rut_contraparte: "96572360-9", monto_total: 5768543 },
  { tipo_doc: 33, folio: 418, rut_contraparte: "96572360-9", monto_total: 1440791 },
  { tipo_doc: 33, folio: 417, rut_contraparte: "96572360-9", monto_total: 1440791 },
  { tipo_doc: 33, folio: 416, rut_contraparte: "96572360-9", monto_total: 1440791 },
  { tipo_doc: 33, folio: 414, rut_contraparte: "96572360-9", monto_total: 1260693 },
  { tipo_doc: 33, folio: 413, rut_contraparte: "96572360-9", monto_total: 2701484 },
  { tipo_doc: 33, folio: 412, rut_contraparte: "96572360-9", monto_total: 3757105 },
  { tipo_doc: 33, folio: 415, rut_contraparte: "96572360-9", monto_total: 1260693 },
  {
    tipo_doc: 61,
    folio: 88,
    rut_contraparte: "96572360-9",
    monto_total: 1440791,
    ref_tipo_doc: 33,
    ref_folio: 417,
  },
  {
    tipo_doc: 61,
    folio: 84,
    rut_contraparte: "96572360-9",
    monto_total: 1440791,
    ref_tipo_doc: 33,
    ref_folio: 417,
  },
  {
    tipo_doc: 61,
    folio: 81,
    rut_contraparte: "96572360-9",
    monto_total: 1440791,
    ref_tipo_doc: 33,
    ref_folio: 417,
  },
  {
    tipo_doc: 61,
    folio: 80,
    rut_contraparte: "96572360-9",
    monto_total: 1260693,
    ref_tipo_doc: 33,
    ref_folio: 415,
  },
  {
    tipo_doc: 61,
    folio: 83,
    rut_contraparte: "96572360-9",
    monto_total: 1440791,
    ref_tipo_doc: 33,
    ref_folio: 418,
  },
];

describe("rcv-anuladas · datos reales (regresión de bugs de prod)", () => {
  it("Kaufmann Junio: conserva las cinco referencias como efecto por verificar", () => {
    const { rows, notasHuerfanas, asociacionesPendientes } = agruparConReferencias(KAUFMANN_JUNIO);
    expect(rows).toHaveLength(8); // 8 facturas
    expect(notasHuerfanas).toHaveLength(5);
    expect(asociacionesPendientes).toHaveLength(5);
    expect(
      asociacionesPendientes.every(
        (association) => association.status === "reference_effect_unknown",
      ),
    ).toBe(true);

    const r417 = rows.find((r) => r.factura.folio === 417);
    expect(r417?.notas).toHaveLength(0);
    expect(r417?.estado).toBe("vigente");
    expect(r417?.sobreCredito).toBe(false);

    // Sin CodRef/fecha/procedencia ninguna referencia legacy cambia la factura.
    for (const folio of [415, 418]) {
      const r = rows.find((x) => x.factura.folio === folio);
      expect(r?.estado).toBe("vigente");
      expect(r?.neto).toBe(r?.factura.monto_total);
      expect(r?.sobreCredito).toBe(false);
    }

    // 416 tiene el mismo monto que 417 pero NINGUNA NC la referencia → vigente.
    expect(rows.find((r) => r.factura.folio === 416)?.estado).toBe("vigente");
  });

  it("Kaufmann Junio: el payload slim histórico no publica un total sin bridge completo", () => {
    const totals = computeRcvTotals(KAUFMANN_JUNIO);
    expect(totals.grossTotal).toBeNull();
    expect(totals.ncTotal).toBeNull();
    expect(totals.total).toBeNull();
    expect(totals.ncCount).toBe(5);
  });

  it("Kaufmann Junio: ninguna inferencia legacy altera el neto de una fila", () => {
    const { rows } = agruparConReferencias(KAUFMANN_JUNIO);
    for (const r of rows) {
      expect(r.neto).toBe(r.factura.monto_total);
      expect(r.sobreCredito).toBe(false);
    }
  });

  it("Compras con tipo_doc:null no rompe y no agrupa NC (comportamiento inerte)", () => {
    // Shape real del slim de Compras: tipo_doc y tipo_doc_nombre llegan null.
    const comprasNull: AnulableDoc[] = [
      {
        tipo_doc: null as unknown as number,
        folio: 12664,
        rut_contraparte: "76604748-3",
        monto_total: 68261,
      },
      {
        tipo_doc: null as unknown as number,
        folio: 1003,
        rut_contraparte: "76242779-6",
        monto_total: 1009090,
      },
    ];
    const { rows, notasHuerfanas } = agruparConReferencias(comprasNull);
    expect(rows).toHaveLength(2); // ambos tratados como facturas (no NC)
    expect(notasHuerfanas).toHaveLength(0);
    expect(rows.every((r) => r.estado === "vigente")).toBe(true);

    const totals = computeRcvTotals(comprasNull);
    expect(totals.total).toBeNull();
    expect(totals.ncCount).toBe(0);
  });

  it("tolera monto_neto/monto_iva null con monto_total presente (fila 'SOCIEDAD PROFESIONALES')", () => {
    const docs: AnulableDoc[] = [
      {
        tipo_doc: 33,
        folio: 109,
        rut_contraparte: "78163706-8",
        monto_neto: undefined,
        monto_iva: undefined,
        monto_total: 120520,
      },
    ];
    const totals = computeRcvTotals(docs);
    expect(totals.total).toBeNull();
    expect(totals.neto).toBeNull();
    expect(totals.iva).toBeNull();
  });
});
