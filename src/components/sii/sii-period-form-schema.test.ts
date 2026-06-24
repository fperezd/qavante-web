/* Tests del schema + helpers de período SII. Determinístico vía `now`
   inyectado donde aplica — sin clocks reales.

   Convención Qavante: el usuario ve/escribe MM-AAAA (mes antes que año);
   internamente se normaliza a YYYY-MM para el backend. */
import { describe, expect, it } from "vitest";
import {
  defaultPeriod,
  formatPeriodLabel,
  normalizePeriod,
  siiPeriodFormSchema,
} from "./sii-period-form-schema";

describe("siiPeriodFormSchema — validación de período (MM-AAAA)", () => {
  it("acepta MM-AAAA válido (mes 1-12)", () => {
    for (const m of ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]) {
      expect(siiPeriodFormSchema.safeParse({ periodo: `${m}-2026` }).success).toBe(true);
    }
  });

  it("trimea espacios al lado", () => {
    const r = siiPeriodFormSchema.safeParse({ periodo: "  04-2026  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.periodo).toBe("04-2026");
  });

  it("rechaza vacío", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "   " }).success).toBe(false);
  });

  it("rechaza meses fuera de rango", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "00-2026" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "13-2026" }).success).toBe(false);
  });

  it("rechaza el orden invertido AAAA-MM (justamente lo que no queremos)", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "2026-04" }).success).toBe(false);
  });

  it("rechaza formatos no numéricos / separadores raros", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "abril 2026" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "04/2026" }).success).toBe(false);
    expect(siiPeriodFormSchema.safeParse({ periodo: "04.2026" }).success).toBe(false);
  });

  it("rechaza año con menos de 4 dígitos", () => {
    expect(siiPeriodFormSchema.safeParse({ periodo: "04-26" }).success).toBe(false);
  });
});

describe("defaultPeriod — mes anterior al actual (MM-AAAA)", () => {
  it("desde un mes intermedio (abril 2026) → 03-2026", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 3, 15)))).toBe("03-2026");
  });

  it("desde febrero → 01-2026", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 1, 1)))).toBe("01-2026");
  });

  it("desde enero → 12-2025 (diciembre del año anterior)", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 0, 1)))).toBe("12-2025");
  });

  it("desde diciembre → 11-2026", () => {
    expect(defaultPeriod(new Date(Date.UTC(2026, 11, 31)))).toBe("11-2026");
  });
});

describe("normalizePeriod — siempre YYYY-MM para el backend", () => {
  it("MM-AAAA del usuario → YYYY-MM", () => {
    expect(normalizePeriod("04-2026")).toBe("2026-04");
    expect(normalizePeriod("12-2026")).toBe("2026-12");
  });

  it("YYYY-MM ya normalizado se mantiene (defensa)", () => {
    expect(normalizePeriod("2026-04")).toBe("2026-04");
  });

  it("YYYYMM compacto se transforma", () => {
    expect(normalizePeriod("202604")).toBe("2026-04");
  });

  it("trimea espacios al lado", () => {
    expect(normalizePeriod("  04-2026  ")).toBe("2026-04");
  });
});

describe("formatPeriodLabel — label humano", () => {
  it("YYYY-MM → 'Mes Año' en español", () => {
    expect(formatPeriodLabel("2026-04")).toBe("Abril 2026");
    expect(formatPeriodLabel("2026-12")).toBe("Diciembre 2026");
    expect(formatPeriodLabel("2025-01")).toBe("Enero 2025");
  });

  it("MM-AAAA también funciona (se normaliza primero)", () => {
    expect(formatPeriodLabel("04-2026")).toBe("Abril 2026");
  });

  it("formato inesperado se devuelve as-is (defensa)", () => {
    expect(formatPeriodLabel("invalid")).toBe("invalid");
  });
});
