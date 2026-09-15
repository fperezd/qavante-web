import { describe, expect, it } from "vitest";
import { bheSourceExternalId, isDteCorrector, rcvSourceExternalId } from "./document-resolution-id";
import type { RcvDoc } from "./rcv-grouped-item";

describe("identidades canónicas para gestionar documentos", () => {
  it("construye la clave RCV sin puntos ni espacios en el RUT", () => {
    expect(
      rcvSourceExternalId({
        tipo_doc: 33,
        folio: 1136,
        rut_contraparte: "76.242.779-6",
      }),
    ).toBe("33-1136-76242779-6");
  });

  it("construye la identidad BHE con período, emisor y folio", () => {
    expect(
      bheSourceExternalId({
        anulada: false,
        periodo: "2026-08",
        fecha_emision: "2026-08-31",
        rut_emisor: "10.891.877-2",
        folio: 81,
      }),
    ).toBe("202608:10891877-2:81");
  });

  it("no inventa identidad cuando faltan campos de origen", () => {
    expect(rcvSourceExternalId({ tipo_doc: 33, folio: 1 })).toBeNull();
    expect(
      rcvSourceExternalId({
        tipo_doc: null,
        folio: null,
        rut_contraparte: "76.242.779-K",
      } as unknown as RcvDoc),
    ).toBeNull();
    expect(
      bheSourceExternalId({
        anulada: false,
        fecha_emision: "",
        rut_emisor: "10.891.877-2",
        folio: 81,
      }),
    ).toBeNull();
    expect(
      bheSourceExternalId({
        anulada: false,
        periodo: "2026-08",
        fecha_emision: "2026-08-31",
        rut_emisor: "10.891.877-2",
        folio: null,
      }),
    ).toBeNull();
  });

  it("preserva el DV K en mayúscula como la clave cruda persistida por el API", () => {
    expect(rcvSourceExternalId({ tipo_doc: 33, folio: 9, rut_contraparte: "76.242.779-k" })).toBe(
      "33-9-76242779-K",
    );
  });

  it("la clave D07 no mezcla dos correctores del mismo RUT y monto", () => {
    const docs: RcvDoc[] = [
      { tipo_doc: 61, folio: 1, rut_contraparte: "76111111-1", monto_total: 5000 },
      { tipo_doc: 56, folio: 2, rut_contraparte: "76111111-1", monto_total: 5000 },
    ];

    expect(docs.map(rcvSourceExternalId)).toEqual(["61-1-76111111-1", "56-2-76111111-1"]);
    expect([56, 61, 111, 112].every((tipo_doc) => isDteCorrector({ tipo_doc }))).toBe(true);
    // Gemelo: una factura no es un corrector y por eso nunca lleva badge de evidencia.
    expect(isDteCorrector({ tipo_doc: 33 })).toBe(false);
  });

  it("no muta montos, estado ni vencimiento al construir las claves D07", () => {
    const doc: RcvDoc = {
      tipo_doc: 61,
      folio: 8,
      rut_contraparte: "76111111-1",
      monto_total: 119000,
      due_date: "2026-09-30",
      due_date_source: "sii",
      estado: "REGISTRO",
    };
    const before = structuredClone(doc);

    rcvSourceExternalId(doc);

    expect(doc).toEqual(before);
  });
});
