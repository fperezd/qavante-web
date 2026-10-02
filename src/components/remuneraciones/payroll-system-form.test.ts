import { describe, it, expect } from "vitest";
import {
  PAYROLL_SYSTEM_IDS,
  PAYROLL_SYSTEM_OPTIONS,
  describeEra,
  describeStatus,
  formToRequest,
  formatPeriod,
  isPayrollSystemId,
  monthInputToPeriod,
  payrollSystemLabel,
  periodOf,
  periodToMonthInput,
} from "./payroll-system-form";

describe("payroll-system-form — las tres opciones", () => {
  it("son exactamente BUK, Talana y Manual, en ese orden", () => {
    expect(PAYROLL_SYSTEM_IDS).toEqual(["buk", "talana", "manual"]);
    expect(PAYROLL_SYSTEM_OPTIONS.map((o) => o.id)).toEqual([...PAYROLL_SYSTEM_IDS]);
  });

  it("toda opción tiene etiqueta y descripción no vacías", () => {
    for (const option of PAYROLL_SYSTEM_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  it("no existe una cuarta opción: 'ninguno' / '' / previred no son sistemas", () => {
    for (const bogus of ["", "ninguno", "previred", "BUK ", null, undefined, 7]) {
      expect(isPayrollSystemId(bogus)).toBe(false);
      expect(payrollSystemLabel(bogus as string)).toBeNull();
    }
  });
});

describe("payroll-system-form — períodos", () => {
  it("periodOf toma el mes de la fecha", () => {
    expect(periodOf(new Date(2026, 8, 15))).toBe("202609");
    expect(periodOf(new Date(2026, 0, 1))).toBe("202601");
  });

  it("ida y vuelta entre YYYYMM y el input de mes", () => {
    expect(periodToMonthInput("202610")).toBe("2026-10");
    expect(monthInputToPeriod("2026-10")).toBe("202610");
    expect(monthInputToPeriod(periodToMonthInput("202701"))).toBe("202701");
  });

  it("un mes inválido no se convierte en período (no se adivina)", () => {
    for (const bad of ["", "2026-13", "2026-00", "202610", "abc", "2026-1"]) {
      expect(monthInputToPeriod(bad)).toBe("");
    }
  });

  it("formatPeriod escribe el mes en español y devuelve el crudo si no es válido", () => {
    expect(formatPeriod("202609")).toBe("septiembre de 2026");
    expect(formatPeriod("202613")).toBe("202613");
  });
});

describe("describeStatus — un pendiente NO se muestra como BUK", () => {
  it("sin declaración dice que falta elegir y avisa que Qavante sigue suponiendo BUK", () => {
    const status = describeStatus({ declared: false, payroll_system: null });
    expect(status.declared).toBe(false);
    expect(status.tone).toBe("pending");
    expect(status.title).toMatch(/no elegiste/i);
    /* El copy nombra BUK porque ESO es lo que está pasando hoy; lo que no hace es
       presentar BUK como la elección de la empresa. */
    expect(status.title).not.toMatch(/Tu sistema de remuneraciones:/);
    expect(status.detail).toMatch(/BUK/);
  });

  it("un payroll_system desconocido se trata como no declarado, no como válido", () => {
    const status = describeStatus({ declared: true, payroll_system: "sap" });
    expect(status.declared).toBe(false);
    expect(status.tone).toBe("pending");
  });

  it("BUK declarado con adaptador activo dice que trae la planilla", () => {
    const status = describeStatus({
      declared: true,
      payroll_system: "buk",
      adapter_state: "active",
      effective_from_period: "202601",
    });
    expect(status.tone).toBe("ok");
    expect(status.title).toContain("BUK");
    expect(status.detail).toContain("enero de 2026");
  });

  it("manual dice que la nómina entra por archivo y que no se conecta a nada", () => {
    const status = describeStatus({
      declared: true,
      payroll_system: "manual",
      adapter_state: "manual_upload",
      effective_from_period: "202610",
    });
    expect(status.tone).toBe("info");
    expect(status.detail).toMatch(/no intenta conectarse/i);
    expect(status.detail).toContain("octubre de 2026");
  });

  it("talana declarado NO promete que traiga la planilla", () => {
    const status = describeStatus({
      declared: true,
      payroll_system: "talana",
      adapter_state: "pending_adapter",
    });
    expect(status.tone).toBe("info");
    expect(status.detail).toMatch(/todavía no está disponible/i);
    expect(status.detail).toMatch(/no trae tu planilla/i);
  });
});

describe("describeEra — la historia conserva de dónde vino cada tramo", () => {
  it("una era cerrada declara su desde y su hasta", () => {
    expect(
      describeEra({
        payroll_system: "buk",
        effective_from_period: "202601",
        effective_to_period: "202610",
      }),
    ).toBe("BUK: desde enero de 2026 hasta octubre de 2026");
  });

  it("la era abierta se marca vigente", () => {
    expect(describeEra({ payroll_system: "manual", effective_from_period: "202610" })).toContain(
      "(vigente)",
    );
  });
});

describe("formToRequest", () => {
  it("arma el cuerpo con el sistema y el período", () => {
    expect(formToRequest({ payrollSystem: "manual", monthInput: "2026-10" })).toEqual({
      payroll_system: "manual",
      effective_from_period: "202610",
    });
  });

  it("no envía nada si falta el sistema o el mes no es válido", () => {
    expect(formToRequest({ payrollSystem: "", monthInput: "2026-10" })).toBeNull();
    expect(formToRequest({ payrollSystem: "sap", monthInput: "2026-10" })).toBeNull();
    expect(formToRequest({ payrollSystem: "buk", monthInput: "" })).toBeNull();
    expect(formToRequest({ payrollSystem: "buk", monthInput: "2026-13" })).toBeNull();
  });

  it("el cuerpo NUNCA lleva la empresa: la elige el scope del request", () => {
    const body = formToRequest({ payrollSystem: "buk", monthInput: "2026-10" });
    expect(Object.keys(body ?? {}).sort()).toEqual(["effective_from_period", "payroll_system"]);
  });
});
