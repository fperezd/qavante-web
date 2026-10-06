import { describe, it, expect } from "vitest";
import { debtorInvoiceKey, indexInvoicesByRut } from "./debtor-invoices";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";

const doc = (rut: string, folio: number, razon?: string): RcvDoc => ({
  rut_contraparte: rut,
  razon_social: razon,
  folio,
  fecha: "2026-05-10",
  monto_total: 100000,
});

describe("indexInvoicesByRut", () => {
  it("agrupa por RUT del cliente normalizando el formato (con y sin puntos)", () => {
    const map = indexInvoicesByRut([
      [doc("96.572.360-9", 1)],
      [doc("96572360-9", 3)], // mismo cliente, otro mes, formato distinto
    ]);
    expect(map.get("96572360-9")?.map((d) => d.folio)).toEqual([1, 3]);
  });

  /* GEMELO NEGATIVO: dos RUT REALES distintos siguen en buckets distintos. Si el arreglo del
     centinela se pasara de largo y agrupara por nombre siempre, este test caería. */
  it("dos clientes con RUT real distinto NO se funden", () => {
    const map = indexInvoicesByRut([
      [doc("96572360-9", 1, "COMERCIAL KAUFMANN S.A."), doc("77111222-3", 2, "OTRA EMPRESA SPA")],
    ]);
    expect(map.size).toBe(2);
    expect(map.get("96572360-9")?.map((d) => d.folio)).toEqual([1]);
    expect(map.get("77111222-3")?.map((d) => d.folio)).toEqual([2]);
  });

  /* EL DEFECTO: el centinela `55.555.555-5` pasa el módulo 11, así que entraba como un RUT de
     cliente cualquiera y TODOS los extranjeros compartían bucket — expandir uno mostraba las
     facturas de los demás. */
  it("el centinela de extranjero NO funde clientes distintos", () => {
    const map = indexInvoicesByRut([
      [
        doc("55555555-5", 1, "DIVEIMPORT S.A."),
        doc("55.555.555-5", 2, "ANTHROPIC, PBC"),
        doc("55555555-5", 3, "DIVEIMPORT S.A."),
      ],
    ]);
    expect(map.get("55555555-5")).toBeUndefined();
    expect(map.get("sin-rut:DIVEIMPORT S.A.")?.map((d) => d.folio)).toEqual([1, 3]);
    expect(map.get("sin-rut:ANTHROPIC, PBC")?.map((d) => d.folio)).toEqual([2]);
  });

  it("`SIN-RUT` y `S/D` se contienen igual que el centinela", () => {
    const map = indexInvoicesByRut([
      [doc("SIN-RUT", 1, "GITHUB, INC."), doc("S/D", 2, "NEON, LLC")],
    ]);
    expect(map.get("sin-rut:GITHUB, INC.")?.map((d) => d.folio)).toEqual([1]);
    expect(map.get("sin-rut:NEON, LLC")?.map((d) => d.folio)).toEqual([2]);
  });

  /* Antes se descartaba: un documento sin RUT ni razón social desaparecía del panel y su monto
     con él. Ahora queda en un bucket EXPLÍCITO, que es distinto de disfrazarlo de cliente. */
  it("un documento sin RUT ni razón social queda en su propio bucket, no se pierde", () => {
    const map = indexInvoicesByRut([
      [{ folio: 9, fecha: "2026-05-01" } as RcvDoc, doc("11111111-1", 5)],
    ]);
    expect(map.size).toBe(2);
    expect(map.get("11111111-1")?.length).toBe(1);
    expect(map.get("sin-rut:sin-identificar")?.map((d) => d.folio)).toEqual([9]);
  });

  it("rango vacío → mapa vacío", () => {
    expect(indexInvoicesByRut([]).size).toBe(0);
    expect(indexInvoicesByRut([[]]).size).toBe(0);
  });

  /* El orden de recorrido NO puede cambiar el resultado: era justo lo que rompía el defecto
     (el primer nombre recorrido se quedó con la plata de los demás). */
  it("el orden de recorrido no cambia el agrupamiento", () => {
    const docs = [
      doc("55555555-5", 1, "HETZNER ONLINE GMBH"),
      doc("55555555-5", 2, "GOOGLE LLC"),
      doc("96572360-9", 3, "COMERCIAL KAUFMANN S.A."),
    ];
    const directo = indexInvoicesByRut([docs]);
    const alReves = indexInvoicesByRut([[...docs].reverse()]);
    expect([...alReves.keys()].sort()).toEqual([...directo.keys()].sort());
    for (const k of directo.keys()) {
      expect(
        alReves
          .get(k)
          ?.map((d) => d.folio)
          .sort(),
      ).toEqual(
        directo
          .get(k)
          ?.map((d) => d.folio)
          .sort(),
      );
    }
  });
});

describe("debtorInvoiceKey", () => {
  it("con RUT real devuelve el RUT normalizado", () => {
    expect(debtorInvoiceKey("96.572.360-9", "COMERCIAL KAUFMANN S.A.")).toBe("96572360-9");
  });

  it("con identidad débil devuelve la razón social prefijada", () => {
    expect(debtorInvoiceKey("55555555-5", "HETZNER ONLINE GMBH")).toBe(
      "sin-rut:HETZNER ONLINE GMBH",
    );
    expect(debtorInvoiceKey(null, "GAMMA")).toBe("sin-rut:GAMMA");
    expect(debtorInvoiceKey("S/D", null)).toBe("sin-rut:sin-identificar");
  });
});
