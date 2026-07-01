import { describe, expect, it } from "vitest";
import {
  computeLibroKpis,
  concentrationByCounterparty,
  docsToCsv,
  isNotaCredito,
  type LibroDoc,
} from "./libro-kpis-format";

const docs: LibroDoc[] = [
  { tipo_doc: 33, folio: 1, rut_contraparte: "76418976-0", razon_social: "Aguas de Antofagasta", monto_neto: 1000000, monto_iva: 190000, monto_total: 1190000 },
  { tipo_doc: 33, folio: 2, rut_contraparte: "96572360-9", razon_social: "Kaufmann", monto_neto: 2000000, monto_iva: 380000, monto_total: 2380000 },
  { tipo_doc: 33, folio: 3, rut_contraparte: "76418976-0", razon_social: "Aguas de Antofagasta", monto_neto: 500000, monto_iva: 95000, monto_total: 595000 },
  { tipo_doc: 61, folio: 4, rut_contraparte: "96572360-9", razon_social: "Kaufmann", monto_neto: 200000, monto_iva: 38000, monto_total: 238000 }, // NC
];

describe("libro-kpis-format", () => {
  it("isNotaCredito detecta 60/61/112", () => {
    expect(isNotaCredito(61)).toBe(true);
    expect(isNotaCredito(33)).toBe(false);
    expect(isNotaCredito(null)).toBe(false);
  });

  it("computeLibroKpis separa bruto y notas de crédito", () => {
    const k = computeLibroKpis(docs);
    expect(k.docCount).toBe(3);
    expect(k.ncCount).toBe(1);
    expect(k.grossTotal).toBe(1190000 + 2380000 + 595000);
    expect(k.ncTotal).toBe(238000);
    expect(k.netTotal).toBe(k.grossTotal - 238000);
    expect(k.iva).toBe(190000 + 380000 + 95000);
  });

  it("concentrationByCounterparty agrupa por RUT excluyendo NC, ordenado desc", () => {
    const c = concentrationByCounterparty(docs, 5);
    expect(c[0]?.rut).toBe("96572360-9"); // 2.380.000
    expect(c[1]?.rut).toBe("76418976-0"); // 1.190.000 + 595.000 = 1.785.000
    expect((c[0]?.pct ?? 0) + (c[1]?.pct ?? 0)).toBeCloseTo(100);
  });

  it("docsToCsv arma headers + filas con separador ;", () => {
    const csv = docsToCsv(docs.slice(0, 1));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Tipo;Folio;Fecha;RUT;Razon social;Neto;IVA;Total");
    expect(lines[1]).toContain("76418976-0");
    expect(lines[1]).toContain("1190000");
  });
});
