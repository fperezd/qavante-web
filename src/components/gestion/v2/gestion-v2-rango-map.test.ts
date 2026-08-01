import { describe, it, expect } from "vitest";
import {
  baseIncompleta,
  mapRangoResumen,
  rangoConfiable,
  rangoIncompleto,
  warningLabel,
} from "./gestion-v2-rango-map";
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

describe("baseIncompleta", () => {
  it("marca incompleto un año con ingresos altos y gastos ~0 (planilla no cargada)", () => {
    // Caso real 2025 (ene-jul): ingresos 88,5M, bruto 72,1M, resultado 70,2M ⇒ gastos 1,9M (2,6%).
    expect(baseIncompleta(88_558_398, 72_144_766, 70_255_269)).toBe(true);
  });

  it("NO marca incompleto un año con gastos reales", () => {
    // Caso real 2026 (ene-jul): gastos = 112,7M − 37,8M = 74,9M (66% del bruto).
    expect(baseIncompleta(189_765_944, 112_737_279, 37_847_586)).toBe(false);
  });

  it("no aplica si no hay ingresos o no hay margen bruto", () => {
    expect(baseIncompleta(0, 0, 0)).toBe(false);
    expect(baseIncompleta(100, 0, 0)).toBe(false);
    expect(baseIncompleta(-100, -50, -50)).toBe(false);
  });

  it("umbral: gastos exactamente 5% del bruto NO es incompleto; apenas menos sí", () => {
    expect(baseIncompleta(1000, 1000, 950)).toBe(false); // gastos 50 = 5% → completo
    expect(baseIncompleta(1000, 1000, 951)).toBe(true); // gastos 49 < 5% → incompleto
  });

  it("rangoIncompleto envuelve el resumen (y null → false)", () => {
    expect(rangoIncompleto(null)).toBe(false);
    const r = mapRangoResumen(BD);
    // BD tiene gastos reales (opex) → completo.
    expect(rangoIncompleto(r)).toBe(false);
  });
});
