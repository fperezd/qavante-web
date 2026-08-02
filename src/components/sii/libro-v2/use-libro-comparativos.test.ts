import { describe, it, expect } from "vitest";
import { toHeroComparativos } from "./use-libro-comparativos";
import type { LibroComparativosResponse } from "@/lib/api/sii";

const base: LibroComparativosResponse = {
  neto_periodo: "100",
  stale: false,
} as LibroComparativosResponse;

describe("toHeroComparativos (cableado #766)", () => {
  it("mapea los 3 comparativos con sus labels de dueño", () => {
    const r = {
      ...base,
      mismo_dia_mes_anterior: { pct: 12.5, dia_corte: 15, neto_actual: "21", neto_base: "18" },
      mes_vs_promedio_anual: { pct: 55, mes_label: "julio", neto_mes: "42", promedio_anual: "27" },
      yoy: { pct: 13, neto_periodo: "189", neto_anio_anterior: "167" },
    } as LibroComparativosResponse;
    const out = toHeroComparativos(r);
    expect(out).toEqual([
      { pct: 12.5, label: "este mes vs. misma fecha del mes anterior" },
      { pct: 55, label: "julio sobre el promedio mensual del año" },
      { pct: 13, label: "vs. el mismo período del año anterior" },
    ]);
  });

  it("OMITE un comparativo si su base es 0 (no inventa % contra base en cero)", () => {
    const r = {
      ...base,
      mismo_dia_mes_anterior: { pct: -100, dia_corte: 2, neto_actual: "0", neto_base: "0" },
      yoy: { pct: 0, neto_periodo: "100", neto_anio_anterior: "0" },
    } as LibroComparativosResponse;
    expect(toHeroComparativos(r)).toEqual([]);
  });

  it("sin data → lista vacía", () => {
    expect(toHeroComparativos(undefined)).toEqual([]);
  });
});
