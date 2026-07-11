import { describe, it, expect } from "vitest";
import { flattenBreakdown, formatMonthColumn } from "./breakdown-format";
import type { BreakdownRow } from "@/lib/api/gestion";

const row = (label: string, children?: BreakdownRow[]): BreakdownRow => ({
  kind: children ? "section" : "account",
  key: label,
  label,
  by_month: ["100"],
  total: "100",
  children,
});

const tree: BreakdownRow[] = [
  row("Ingresos", [row("Proyectos"), row("Servicio Mensual")]),
  row("Costos", [row("Sueldos")]),
];

describe("flattenBreakdown", () => {
  it("todo expandido por default → aplana hijos y marca depth", () => {
    const flat = flattenBreakdown(tree, new Set());
    expect(flat.map((f) => f.row.label)).toEqual([
      "Ingresos",
      "Proyectos",
      "Servicio Mensual",
      "Costos",
      "Sueldos",
    ]);
    expect(flat[1]?.depth).toBe(1);
    expect(flat[0]?.hasChildren).toBe(true);
    expect(flat[1]?.hasChildren).toBe(false);
  });

  it("un nodo colapsado oculta a sus hijos", () => {
    // id "0" = primer nodo raíz (Ingresos).
    const flat = flattenBreakdown(tree, new Set(["0"]));
    expect(flat.map((f) => f.row.label)).toEqual(["Ingresos", "Costos", "Sueldos"]);
    expect(flat[0]?.expanded).toBe(false);
  });

  it("ids estables por posición", () => {
    const flat = flattenBreakdown(tree, new Set());
    expect(flat.map((f) => f.id)).toEqual(["0", "0/0", "0/1", "1", "1/0"]);
  });
});

describe("formatMonthColumn", () => {
  it("YYYY-MM → 'Mmm YYYY'", () => {
    expect(formatMonthColumn("2026-02")).toBe("Feb 2026");
    expect(formatMonthColumn("2026-12")).toBe("Dic 2026");
  });
  it("formato desconocido → string original", () => {
    expect(formatMonthColumn("basura")).toBe("basura");
  });
});
