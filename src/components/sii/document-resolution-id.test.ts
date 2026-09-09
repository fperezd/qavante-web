import { describe, expect, it } from "vitest";
import { bheSourceExternalId, rcvSourceExternalId } from "./document-resolution-id";
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
});
