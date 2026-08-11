import { describe, it, expect } from "vitest";
import {
  baseIncompleta,
  mapRangoResumen,
  margenDistorsionado,
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
  it("payroll_cost_missing (CC-API #895) → falta la nómina, resultado sobreestimado", () => {
    expect(warningLabel("payroll_cost_missing")).toMatch(/nómina/i);
    expect(warningLabel("payroll_cost_missing")).toMatch(/sincroniza remuneraciones/i);
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

  it("mejor mes + tendencia EXCLUYEN el mes en curso (jul = proforma); el label sí lo incluye", () => {
    // jul es el mes EN CURSO (proforma) → su margen parcial (24.3%) no se compara: mejor mes = jun,
    // y la tendencia va solo hasta el último mes CERRADO. El rango (label) sí abarca may–jul.
    expect(r.mejorMes).toEqual({ periodo: "jun", pct: 23.2 });
    expect(r.rangoLabel).toBe("may–jul");
    expect(r.tendencia.map((p) => p.margenPct)).toEqual([20.4, 23.2]);
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
  it("NO confiable si el backend avisa margen distorsionado, aunque el margen dé ≤100% (#734)", () => {
    // Mismo P&L "normal" (margen 60%, pasaría el chequeo de ≤100%) pero con el warning de costos
    // faltantes → el margen está inflado → degradamos honesto.
    const distorsionado = { ...BD, warnings: ["product_income_without_cogs"] };
    expect(margenDistorsionado(distorsionado)).toBe(true);
    expect(rangoConfiable(distorsionado)).toBe(false);
    expect(margenDistorsionado(BD)).toBe(false); // sin warnings → no distorsionado
  });
  it("payroll_cost_missing también distorsiona (resultado sobreestimado sin la nómina, #895)", () => {
    const sinNomina = { ...BD, warnings: ["payroll_cost_missing"] };
    expect(margenDistorsionado(sinNomina)).toBe(true);
    expect(rangoConfiable(sinNomina)).toBe(false);
  });
});

describe("baseIncompleta", () => {
  // Referencia = el negocio HOY (año actual). base = (bruto, neto); ref = (bruto, neto).
  it("marca incompleto un año base sin planilla, contra un año actual con gastos reales", () => {
    // Base 2025: bruto 72,1M, resultado 70,2M ⇒ gastos 2,6% del bruto. Ref 2026: gastos 66%.
    expect(baseIncompleta(72_144_766, 70_255_269, 112_737_279, 37_847_586)).toBe(true);
  });

  it("NO marca incompleto un año con gastos reales", () => {
    // Base y ref ambos con gasto material (66%).
    expect(baseIncompleta(112_737_279, 37_847_586, 112_737_279, 37_847_586)).toBe(false);
  });

  it("micro-PYME lean REAL (gastos bajos en base Y referencia) NO se marca — evita el falso positivo", () => {
    // Consultora unipersonal sin planilla: bruto 5M, resultado 4,8M (gastos 4%) en AMBOS períodos.
    // Con un umbral absoluto de 5% se marcaría mal; contra la referencia (también lean) → NO se marca.
    expect(baseIncompleta(5_000_000, 4_800_000, 5_000_000, 4_800_000)).toBe(false);
  });

  it("sin referencia (ref bruto 0) cae al umbral absoluto conservador del 5%", () => {
    expect(baseIncompleta(1000, 951, 0, 0)).toBe(true); // gastos 4,9% < 5%
    expect(baseIncompleta(1000, 950, 0, 0)).toBe(false); // gastos 5% = 5%
  });

  it("no aplica si la base no tiene margen bruto", () => {
    expect(baseIncompleta(0, 0, 100, 20)).toBe(false);
    expect(baseIncompleta(-100, -50, 100, 20)).toBe(false);
  });

  it("rangoIncompleto: base sin gastos vs ref con gastos → true; null → false", () => {
    expect(rangoIncompleto(null, null)).toBe(false);
    const ref = mapRangoResumen(BD); // BD tiene opex real
    // Base sintética sin gastos (neto ≈ bruto) contra la referencia con gastos.
    const baseSinGastos = { ...ref, neto: { monto: ref.bruto.monto - 1, pct: 0 } };
    expect(rangoIncompleto(baseSinGastos, ref)).toBe(true);
    // BD contra sí mismo (gastos reales en ambos) → completo.
    expect(rangoIncompleto(ref, ref)).toBe(false);
  });
});
