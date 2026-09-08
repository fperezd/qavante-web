import { describe, expect, it } from "vitest";
import { adaptRcv } from "./use-maestro-docs";

describe("adaptRcv", () => {
  it("preserva la identidad y convierte códigos SII recibidos como texto", () => {
    const [doc] = adaptRcv([
      {
        rut_contraparte: "76.454.786-1",
        razon_social: "Tooxs Digital SpA",
        fecha: "08/09/2026",
        monto_total: "123456",
        folio: "00123",
        tipo_doc: "33",
        ref_folio: "00099",
        ref_tipo_doc: "61",
        reclamado: true,
        cedido: false,
      },
    ]);

    expect(doc).toMatchObject({
      rut: "76.454.786-1",
      name: "Tooxs Digital SpA",
      fecha: "08/09/2026",
      monto: 123456,
      folio: "00123",
      tipoDoc: 33,
      refFolio: 99,
      refTipoDoc: 61,
      reclamado: true,
      cedido: false,
    });
  });

  it("no inventa códigos para valores vacíos, decimales o no numéricos", () => {
    const [doc] = adaptRcv([
      {
        folio: "  ",
        tipo_doc: "33.5",
        ref_folio: "folio-99",
        ref_tipo_doc: null,
      },
    ]);

    expect(doc).toMatchObject({ folio: null, monto: 0, reclamado: false, cedido: false });
    expect(doc?.tipoDoc).toBeUndefined();
    expect(doc?.refFolio).toBeUndefined();
    expect(doc?.refTipoDoc).toBeUndefined();
  });

  it("mantiene folios numéricos y descarta números no finitos", () => {
    const [valid, invalid] = adaptRcv([{ folio: 123, tipo_doc: 33 }, { folio: Infinity }]);

    expect(valid?.folio).toBe(123);
    expect(valid?.tipoDoc).toBe(33);
    expect(invalid?.folio).toBeNull();
  });
});
