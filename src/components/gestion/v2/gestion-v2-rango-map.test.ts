import { describe, it, expect } from "vitest";
import { mapRangoResumen, rangoConfiable, warningLabel } from "./gestion-v2-rango-map";
import type { OperationalResultBreakdown } from "@/lib/api/gestion";

describe("warningLabel", () => {
  it("traduce el código conocido a lenguaje de dueño", () => {
    expect(warningLabel("product_income_without_cogs")).toMatch(/costo de venta/i);
    expect(warningLabel(" product_income_without_cogs ")).toMatch(/costo de venta/i); // trim
  });
  it("código desconocido → se muestra tal cual (no inventamos)", () => {
    expect(warningLabel("algo_nuevo_del_backend")).toBe("algo_nuevo_del_backend");
  });
});

const BD: OperationalResultBreakdown = {
  generated_at: "2026-07-15T12:00:00Z",
  period_from: "2026-05",
  period_to: "2026-07",
  mode: "por_cuenta",
  months: ["2026-05", "2026-06", "2026-07"],
  proforma_month: "2026-07",
  rows: [
    {
      kind: "section",
      key: "income",
      label: "Ingresos",
      by_month: ["15200000", "16800000", "18500000"],
      total: "50500000",
    },
    {
      kind: "subtotal",
      key: "gross_margin",
      label: "Margen bruto",
      by_month: ["9100000", "10100000", "11100000"],
      total: "30300000",
      pct_total: "60.0",
      pct_by_month: ["59.9", "60.1", "60.0"],
    },
    {
      kind: "subtotal",
      key: "operational_result",
      label: "Resultado operacional",
      by_month: ["3100000", "3900000", "4500000"],
      total: "11500000",
      pct_total: "22.8",
      pct_by_month: ["20.4", "23.2", "24.3"],
    },
  ] as OperationalResultBreakdown["rows"],
};

describe("mapRangoResumen", () => {
  const r = mapRangoResumen(BD);

  it("ingresos acumulados + márgenes bruto y neto ($ y %)", () => {
    expect(r.ingresos).toBe(50_500_000);
    expect(r.bruto).toEqual({ monto: 30_300_000, pct: 60.0 });
    expect(r.neto).toEqual({ monto: 11_500_000, pct: 22.8 });
  });

  it("mejor mes por margen + label del rango + tendencia por mes", () => {
    expect(r.mejorMes).toEqual({ periodo: "jul", pct: 24.3 });
    expect(r.rangoLabel).toBe("may–jul");
    expect(r.tendencia.map((p) => p.margenPct)).toEqual([20.4, 23.2, 24.3]);
  });

  it("deriva el % si el backend no manda pct_total", () => {
    const sinPct = {
      ...BD,
      rows: [
        BD.rows[0],
        {
          kind: "subtotal",
          key: "operational_result",
          label: "Resultado operacional",
          by_month: ["1"],
          total: "5050000",
        },
      ] as OperationalResultBreakdown["rows"],
    };
    expect(mapRangoResumen(sinPct).neto.pct).toBeCloseTo(10, 1); // 5.05M / 50.5M
  });
});

describe("rangoConfiable", () => {
  it("confiable con un P&L normal", () => {
    expect(rangoConfiable(BD)).toBe(true);
  });
  it("NO confiable si el resultado del período supera a los ingresos", () => {
    const malo = {
      ...BD,
      rows: [
        BD.rows[0],
        {
          kind: "subtotal",
          key: "operational_result",
          label: "Resultado operacional",
          by_month: ["1"],
          total: "55000000",
        },
      ] as OperationalResultBreakdown["rows"],
    };
    expect(rangoConfiable(malo)).toBe(false);
  });
});
