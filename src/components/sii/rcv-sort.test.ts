import { describe, expect, it } from "vitest";
import {
  docOf,
  fechaSortKey,
  sortDocs,
  sortGroupedItems,
  sortValue,
  toggleSort,
  type SortableDoc,
} from "./rcv-sort";
import type { GroupedItem } from "./rcv-grouped-item";

const doc = (over: Partial<SortableDoc>): SortableDoc => ({ ...over });

describe("rcv-sort · fechaSortKey", () => {
  it("parsea DD/MM/YYYY y YYYY-MM-DD a YYYYMMDD ordenable", () => {
    expect(fechaSortKey("02/07/2026")).toBe(20260702);
    expect(fechaSortKey("2026-07-02")).toBe(20260702);
    expect(fechaSortKey("2/7/2026")).toBe(20260702);
    expect(fechaSortKey(undefined)).toBe(0);
    expect(fechaSortKey("basura")).toBe(0);
  });
});

describe("rcv-sort · sortValue", () => {
  it("montos ausentes van al fondo en asc (-Infinity)", () => {
    expect(sortValue(doc({}), "total")).toBe(Number.NEGATIVE_INFINITY);
    expect(sortValue(doc({ monto_total: 100 }), "total")).toBe(100);
  });
  it("cliente en minúscula", () => {
    expect(sortValue(doc({ razon_social: "Zeta SA" }), "cliente")).toBe("zeta sa");
  });
});

describe("rcv-sort · sortDocs", () => {
  const docs = [
    doc({ folio: 3, monto_total: 300, razon_social: "C", fecha: "01/03/2026" }),
    doc({ folio: 1, monto_total: 100, razon_social: "A", fecha: "01/01/2026" }),
    doc({ folio: 2, monto_total: 200, razon_social: "B", fecha: "01/02/2026" }),
  ];
  it("ordena por total asc/desc sin mutar", () => {
    const asc = sortDocs(docs, { key: "total", dir: "asc" });
    expect(asc.map((d) => d.monto_total)).toEqual([100, 200, 300]);
    const desc = sortDocs(docs, { key: "total", dir: "desc" });
    expect(desc.map((d) => d.monto_total)).toEqual([300, 200, 100]);
    expect(docs[0]?.folio).toBe(3); // input intacto
  });
  it("sin sort devuelve el mismo orden", () => {
    expect(sortDocs(docs, null)).toBe(docs);
  });
  it("ordena por fecha y cliente", () => {
    expect(sortDocs(docs, { key: "fecha", dir: "asc" }).map((d) => d.folio)).toEqual([1, 2, 3]);
    expect(sortDocs(docs, { key: "cliente", dir: "desc" }).map((d) => d.razon_social)).toEqual([
      "C",
      "B",
      "A",
    ]);
  });
});

describe("rcv-sort · sortGroupedItems / docOf", () => {
  const items: GroupedItem[] = [
    { t: "fac", row: { factura: { folio: 2, monto_total: 200 }, notas: [], neto: 200, estado: "vigente", matchExacto: true, sobreCredito: false } },
    { t: "nc", doc: { folio: 1, monto_total: 100 } },
  ];
  it("docOf extrae la factura o la NC huérfana", () => {
    expect(docOf(items[0]!).folio).toBe(2);
    expect(docOf(items[1]!).folio).toBe(1);
  });
  it("ordena filas agrupadas por el doc representativo", () => {
    const asc = sortGroupedItems(items, { key: "total", dir: "asc" });
    expect(asc.map((i) => docOf(i).monto_total)).toEqual([100, 200]);
  });
});

describe("rcv-sort · toggleSort", () => {
  it("none → asc → desc → none; cambiar de columna reinicia en asc", () => {
    expect(toggleSort(null, "folio")).toEqual({ key: "folio", dir: "asc" });
    expect(toggleSort({ key: "folio", dir: "asc" }, "folio")).toEqual({ key: "folio", dir: "desc" });
    expect(toggleSort({ key: "folio", dir: "desc" }, "folio")).toBeNull();
    expect(toggleSort({ key: "folio", dir: "desc" }, "total")).toEqual({ key: "total", dir: "asc" });
  });
});
