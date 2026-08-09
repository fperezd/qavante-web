import { describe, expect, it } from "vitest";
import { concentrationByCounterparty, docsToCsv } from "./libro-kpis-format";
import type { RcvDoc } from "../rcv-grouped-item";

const docs: RcvDoc[] = [
  {
    tipo_doc: 33,
    folio: 1,
    rut_contraparte: "76418976-0",
    razon_social: "Aguas de Antofagasta",
    monto_neto: 1000000,
    monto_iva: 190000,
    monto_total: 1190000,
  },
  {
    tipo_doc: 33,
    folio: 2,
    rut_contraparte: "96572360-9",
    razon_social: "Kaufmann",
    monto_neto: 2000000,
    monto_iva: 380000,
    monto_total: 2380000,
  },
  {
    tipo_doc: 33,
    folio: 3,
    rut_contraparte: "76418976-0",
    razon_social: "Aguas de Antofagasta",
    monto_neto: 500000,
    monto_iva: 95000,
    monto_total: 595000,
  },
  {
    tipo_doc: 61,
    folio: 4,
    rut_contraparte: "96572360-9",
    razon_social: "Kaufmann",
    monto_neto: 200000,
    monto_iva: 38000,
    monto_total: 238000,
  }, // NC
];

describe("libro-kpis-format", () => {
  it("concentrationByCounterparty agrupa por RUT excluyendo NC, ordenado desc", () => {
    const c = concentrationByCounterparty(docs, 5);
    expect(c[0]?.rut).toBe("96572360-9"); // 2.380.000
    expect(c[1]?.rut).toBe("76418976-0"); // 1.190.000 + 595.000 = 1.785.000
    // La NC (folio 4) NO cuenta → el denominador es solo el bruto (facturas).
    expect((c[0]?.pct ?? 0) + (c[1]?.pct ?? 0)).toBeCloseTo(100);
    expect(c).toHaveLength(2);
  });

  it("concentrationByCounterparty respeta topN", () => {
    expect(concentrationByCounterparty(docs, 1)).toHaveLength(1);
    expect(concentrationByCounterparty([])).toHaveLength(0);
  });

  it("las NC netean el total de su contraparte (mismo neto que el hero)", () => {
    const conNc = [
      {
        tipo_doc: 33,
        folio: 1,
        rut_contraparte: "96572360-9",
        razon_social: "Kaufmann",
        monto_total: 2380000,
      },
      {
        tipo_doc: 61,
        folio: 2,
        rut_contraparte: "96572360-9",
        razon_social: "Kaufmann",
        monto_total: 380000,
      }, // NC
      {
        tipo_doc: 33,
        folio: 3,
        rut_contraparte: "76418976-0",
        razon_social: "Aguas",
        monto_total: 1000000,
      },
    ] as RcvDoc[];
    const c = concentrationByCounterparty(conNc, 5);
    const kauf = c.find((x) => x.rut === "96572360-9");
    expect(kauf?.total).toBe(2000000); // 2.380.000 − 380.000
  });

  it("excluye una contraparte totalmente anulada (neto <= 0)", () => {
    const anulada = [
      {
        tipo_doc: 33,
        folio: 1,
        rut_contraparte: "1-9",
        razon_social: "Anulado",
        monto_total: 500000,
      },
      {
        tipo_doc: 61,
        folio: 2,
        rut_contraparte: "1-9",
        razon_social: "Anulado",
        monto_total: 500000,
      }, // NC total
      {
        tipo_doc: 33,
        folio: 3,
        rut_contraparte: "2-7",
        razon_social: "Vigente",
        monto_total: 300000,
      },
    ] as RcvDoc[];
    const c = concentrationByCounterparty(anulada, 5);
    expect(c.map((x) => x.rut)).toEqual(["2-7"]); // Anulado (neto 0) no aparece
  });

  it("no funde contrapartes distintas sin RUT (keyea por razón social)", () => {
    const sinRut = [
      { tipo_doc: 39, folio: 1, razon_social: "Cliente A", monto_total: 1000 },
      { tipo_doc: 39, folio: 2, razon_social: "Cliente B", monto_total: 2000 },
    ] as RcvDoc[];
    const c = concentrationByCounterparty(sinRut, 5);
    expect(c).toHaveLength(2); // no se funden en un único bucket "s/d"
    expect(c.map((x) => x.name).sort()).toEqual(["Cliente A", "Cliente B"]);
  });

  it("docsToCsv arma headers + filas con separador ; y escapa comillas", () => {
    const csv = docsToCsv(docs.slice(0, 1));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Tipo;Folio;Fecha;RUT;Razon social;Neto;IVA;Total");
    expect(lines[1]).toContain("76418976-0");
    expect(lines[1]).toContain("1190000");
    // Sin caracteres especiales → sin comillas (RFC 4180).
    expect(lines[1]).toContain("Aguas de Antofagasta");
  });

  it("docsToCsv escapa comillas dobles en la razón social", () => {
    const csv = docsToCsv([
      {
        tipo_doc: 33,
        folio: 9,
        rut_contraparte: "1-9",
        razon_social: 'Bar "El Rincón"',
        monto_total: 1000,
      },
    ]);
    expect(csv.split("\r\n")[1]).toContain('"Bar ""El Rincón"""');
  });
});
