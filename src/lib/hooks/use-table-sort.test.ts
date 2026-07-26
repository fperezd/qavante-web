import { describe, it, expect } from "vitest";
import { sortItems, type SortColumn } from "./use-table-sort";

interface Row {
  fecha: string | null;
  nombre: string;
  monto: number;
}

const COLS: Record<string, SortColumn<Row>> = {
  fecha: { key: "fecha", kind: "date", get: (r) => r.fecha },
  nombre: { key: "nombre", kind: "text", get: (r) => r.nombre },
  monto: { key: "monto", kind: "number", get: (r) => r.monto },
};

const rows: Row[] = [
  { fecha: "2026-04-23", nombre: "Banco", monto: 8_774_801 },
  { fecha: "2026-07-21", nombre: "abarrotes", monto: 7_000_000 },
  { fecha: "2026-06-26", nombre: "Zapatos", monto: 7_000_000 },
];

describe("sortItems", () => {
  it("fecha DESC = más nueva primero (el default de la regla de producto)", () => {
    const out = sortItems(rows, COLS.fecha, "desc");
    expect(out.map((r) => r.fecha)).toEqual(["2026-07-21", "2026-06-26", "2026-04-23"]);
  });

  it("fecha ASC = más antigua primero", () => {
    const out = sortItems(rows, COLS.fecha, "asc");
    expect(out.map((r) => r.fecha)).toEqual(["2026-04-23", "2026-06-26", "2026-07-21"]);
  });

  it("monto DESC = grandes primero", () => {
    const out = sortItems(rows, COLS.monto, "desc");
    expect(out.map((r) => r.monto)).toEqual([8_774_801, 7_000_000, 7_000_000]);
  });

  it("nombre ASC = A→Z, acento-insensible y case-insensible", () => {
    const out = sortItems(rows, COLS.nombre, "asc");
    expect(out.map((r) => r.nombre)).toEqual(["abarrotes", "Banco", "Zapatos"]);
  });

  it("no muta el arreglo original", () => {
    const original = [...rows];
    sortItems(rows, COLS.monto, "asc");
    expect(rows).toEqual(original);
  });

  it("nulos/fechas inválidas SIEMPRE al final (en ambas direcciones)", () => {
    const conNulo: Row[] = [
      { fecha: null, nombre: "sin fecha", monto: 1 },
      { fecha: "2026-01-01", nombre: "con fecha", monto: 2 },
    ];
    expect(sortItems(conNulo, COLS.fecha, "desc").map((r) => r.fecha)).toEqual([
      "2026-01-01",
      null,
    ]);
    expect(sortItems(conNulo, COLS.fecha, "asc").map((r) => r.fecha)).toEqual(["2026-01-01", null]);
  });

  it("columna indefinida → devuelve tal cual", () => {
    expect(sortItems(rows, undefined, "desc")).toBe(rows);
  });
});
