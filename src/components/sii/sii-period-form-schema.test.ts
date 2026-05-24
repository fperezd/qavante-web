/* Tests del schema + helpers de período SII. Determinístico vía `now`
   inyectado donde aplica — sin clocks reales. */
import { describe, expect, it } from "vitest";
import {
  defaultPeriod,
  formatPeriodLabel,
  normalizePeriod,
  siiPeriodFormSchema,
} from "./sii-period-form-schema";

describe("siiPeriodFormSchema — validación de período", () => {
  it("acepta YYYY-MM válido (1-12)", () => {
    for (const m of ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]) {
      expect(siiPeriodFormSchema.safeParse({ periodo: `2026-${m}` }).success).toBe(true);
    }
  });

  it("acepta YYYYMM compacto (backend acepta ambos)", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "202604" }).success).toBe(true);
    expect(siiPeriodFormSchema.safeParse({ periodo: "202612" }).success).toBe(true);
  });

  it("trimea espacios al lado", () => {
    const r = siiPeriodFormSchema.safeParse({ periodo: "  2026-04  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.periodo).toBe("2026-04");
  });

  it("rechaza vacío", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "   " }).success).toBe(false);
  });

  it("rechaza meses fuera de rango", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "2026-00" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "2026-13" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "202600" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "202613" }).success).toBe(false);
  });

  it("rechaza formatos no numéricos (texto libre)", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "abril 2026" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "marzo" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "2026/04" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "2026.04" }).success).toBe(false);
  });

  it("rechaza año con menos de 4 dígitos", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "26-04" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "264" }).success).toBe(false);
  });
});

describe("defaultPeriod — mes anterior al actual", () => {
  it("desde un mes intermedio (abril 2026) → marzo 2026", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 3, 15)))).toBe("2026-03");
  });

  it("desde febrero → enero", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 1, 1)))).toBe("2026-01");
  });

  it("desde enero → diciembre del año anterior", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 0, 1)))).toBe("2025-12");
  });

  it("desde diciembre → noviembre del mismo año", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-11");
  });
});

describe("normalizePeriod — siempre YYYY-MM", () => {
  it("YYYY-MM se mantiene", () => {
    expect(normalizePeriod("2026-04")).toBe("2026-04");
  });

  it("YYYYMM se transforma a YYYY-MM", () => {
    expect(normalizePeriod("202604")).toBe("2026-04");
    expect(normalizePeriod("202612")).toBe("2026-12");
  });

  it("trimea espacios al lado", () => {
    expect(normalizePeriod("  2026-04  ")).toBe("2026-04");
  });
});

describe("formatPeriodLabel — label humano", () => {
  it("YYYY-MM → 'Mes Año' en español", () => {
    expect(formatPeriodLabel("2026-04")).toBe("Abril 2026");
    expect(formatPeriodLabel("2026-12")).toBe("Diciembre 2026");
    expect(formatPeriodLabel("2025-01")).toBe("Enero 2025");
  });

  it("YYYYMM también funciona (se normaliza primero)", () => {
    expect(formatPeriodLabel("202604")).toBe("Abril 2026");
  });

  it("formato inesperado se devuelve as-is (defensa)", () => {
    expect(formatPeriodLabel("invalid")).toBe("invalid");
  });
});
