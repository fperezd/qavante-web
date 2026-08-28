/**
 * La URL del PDF depende de la PANTALLA, y el RUT cambia de rol con ella.
 *
 * Las tres vistas del maestro —Clientes, Proveedores, Honorarios— comparten `maestro-view`, y
 * cada una tiene su documento y su endpoint:
 *
 *   ventas       DTE emitido    el API lo dibuja desde el XML del respaldo
 *   compras      DTE recibido   idem
 *   honorarios   BHE            el PDF oficial del SII, tal cual
 *
 * Mandar el RUT en el parámetro que no corresponde **no da error**: el SII ignora el filtro y
 * devuelve otro documento del rango. El usuario ve un PDF que no es el que pidió, y eso es peor
 * que fallar — un error se ve, un documento equivocado no.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { pdfUrlDeDoc } from "./maestro-pdf-url";

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
});

const RUT = "20007253-7";
const DOC = { folio: 7, fechaEmision: new Date(2026, 7, 3) }; // 3 de agosto de 2026

describe("pdfUrlDeDoc", () => {
  it("honorarios pide la BHE por PERÍODO, con el RUT como emisor", () => {
    const url = pdfUrlDeDoc("honorarios", RUT, DOC) ?? "";

    expect(url).toContain("/api/sii/bhe/pdf");
    expect(url).toContain("periodo=2026-08");
    expect(url).toContain(`rut_emisor=${encodeURIComponent(RUT)}`);
  });

  it("compras pide el DTE recibido por RANGO, con el RUT como emisor", () => {
    const url = pdfUrlDeDoc("compras", RUT, DOC) ?? "";

    expect(url).toContain("/api/sii/dte-recibidos/pdf");
    expect(url).toContain("rut_emisor=");
  });

  it("ventas pide el DTE emitido y el RUT pasa a ser el RECEPTOR", () => {
    const url = pdfUrlDeDoc("ventas", RUT, DOC) ?? "";

    expect(url).toContain("/api/sii/dte-emitidos/pdf");
    // EL PUNTO DEL ARCHIVO: en ventas la contraparte es a quien le vendimos.
    expect(url).toContain("rut_receptor=");
    expect(url).not.toContain("rut_emisor=");
  });

  it("el rango de un DTE es el MES de emisión, no el día suelto", () => {
    // El respaldo del SII trunca en rangos grandes y el endpoint ubica el folio ADENTRO del
    // rango que se le pase. Un rango de un solo día no encontraría un folio emitido otro día.
    const url = pdfUrlDeDoc("compras", RUT, DOC) ?? "";

    expect(url).toContain("desde=2026-08-01");
    expect(url).toContain("hasta=2026-08-31");
  });

  it("el último día del mes se calcula bien en un mes de 30 y en febrero", () => {
    const nov =
      pdfUrlDeDoc("compras", RUT, { folio: 1, fechaEmision: new Date(2026, 10, 15) }) ?? "";
    const feb =
      pdfUrlDeDoc("compras", RUT, { folio: 1, fechaEmision: new Date(2024, 1, 15) }) ?? "";

    expect(nov).toContain("hasta=2026-11-30");
    expect(feb).toContain("hasta=2024-02-29"); // bisiesto
  });

  it("la fecha NO pasa por UTC: un día 1 en Chile no se convierte en el mes anterior", () => {
    // `toISOString()` corre la fecha 3-4 horas hacia atrás y un documento del 1 de agosto
    // quedaría con rango de julio, que es donde no está.
    const url = pdfUrlDeDoc("compras", RUT, { folio: 1, fechaEmision: new Date(2026, 7, 1) }) ?? "";

    expect(url).toContain("desde=2026-08-01");
  });

  it("sin fecha de emisión no hay URL, en vez de una que no puede funcionar", () => {
    expect(pdfUrlDeDoc("honorarios", RUT, { folio: 7, fechaEmision: null })).toBeNull();
  });

  it("sin folio tampoco", () => {
    expect(
      pdfUrlDeDoc("compras", RUT, { folio: null, fechaEmision: new Date(2026, 7, 3) }),
    ).toBeNull();
    expect(
      pdfUrlDeDoc("compras", RUT, { folio: 0, fechaEmision: new Date(2026, 7, 3) }),
    ).toBeNull();
  });
});
