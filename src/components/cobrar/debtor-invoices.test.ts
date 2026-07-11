import { describe, it, expect } from "vitest";
import { indexInvoicesByRut } from "./debtor-invoices";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";

const doc = (rut: string, folio: number): RcvDoc => ({
  rut_contraparte: rut,
  folio,
  fecha: "2026-05-10",
  monto_total: 100000,
});

describe("indexInvoicesByRut", () => {
  it("agrupa por RUT del cliente normalizando el formato (con y sin puntos)", () => {
    const map = indexInvoicesByRut([
      [doc("96.572.360-9", 1), doc("55555555-5", 2)],
      [doc("96572360-9", 3)], // mismo cliente, otro mes, formato distinto
    ]);
    expect(map.get("96572360-9")?.map((d) => d.folio)).toEqual([1, 3]);
    expect(map.get("55555555-5")?.map((d) => d.folio)).toEqual([2]);
  });

  it("ignora documentos sin RUT de contraparte", () => {
    const map = indexInvoicesByRut([[{ folio: 9, fecha: "2026-05-01" } as RcvDoc, doc("11111111-1", 5)]]);
    expect(map.size).toBe(1);
    expect(map.get("11111111-1")?.length).toBe(1);
  });

  it("rango vacío → mapa vacío", () => {
    expect(indexInvoicesByRut([]).size).toBe(0);
    expect(indexInvoicesByRut([[]]).size).toBe(0);
  });
});
