import { describe, expect, it } from "vitest";
import { filterEmployees, genderLabel, normalizeEmployee, type EmployeeSlim } from "./buk-format";

describe("buk-format · normalizeEmployee", () => {
  it("lee los campos slim del BUK", () => {
    const e = normalizeEmployee({
      id: 42,
      full_name: "  Ana Pérez  ",
      rut: "12345678-9",
      email: "ana@empresa.cl",
      role: "Analista",
      gender: "F",
      status: "activo",
    });
    expect(e).toEqual({
      id: "42",
      fullName: "Ana Pérez",
      rut: "12345678-9",
      email: "ana@empresa.cl",
      role: "Analista",
      gender: "F",
      active: true,
    });
  });

  it("usa fallbacks (name/position/cargo) y 'Sin nombre'", () => {
    expect(normalizeEmployee({ name: "Beto", position: "Jefe" }).fullName).toBe("Beto");
    expect(normalizeEmployee({ cargo: "Vendedor" }).role).toBe("Vendedor");
    expect(normalizeEmployee({}).fullName).toBe("Sin nombre");
  });

  it("tolera campos ausentes/vacíos → null", () => {
    const e = normalizeEmployee({ id: "1", full_name: "X", rut: "  ", email: "" });
    expect(e.rut).toBeNull();
    expect(e.email).toBeNull();
    expect(e.role).toBeNull();
    expect(e.active).toBeNull();
  });

  it("active: boolean directo o derivado de status", () => {
    expect(normalizeEmployee({ active: false }).active).toBe(false);
    expect(normalizeEmployee({ status: "inactive" }).active).toBe(false);
    expect(normalizeEmployee({ status: "cualquier-cosa" }).active).toBeNull();
  });

  it("id numérico o string → siempre string", () => {
    expect(normalizeEmployee({ id: 7 }).id).toBe("7");
    expect(normalizeEmployee({ id: "abc" }).id).toBe("abc");
    expect(normalizeEmployee({}).id).toBe("");
  });
});

describe("buk-format · genderLabel", () => {
  it("mapea M/F, tolera crudo y null", () => {
    expect(genderLabel("M")).toBe("Masculino");
    expect(genderLabel("femenino")).toBe("Femenino");
    expect(genderLabel("Otro")).toBe("Otro");
    expect(genderLabel(null)).toBeNull();
  });
});

describe("buk-format · filterEmployees", () => {
  const base: EmployeeSlim[] = [
    { id: "1", fullName: "Ana Pérez", rut: "11-1", email: "ana@x.cl", role: "Analista", gender: null, active: true },
    { id: "2", fullName: "Beto Soto", rut: "22-2", email: "beto@x.cl", role: "Jefe", gender: null, active: true },
  ];
  it("filtra por nombre / rut / email / cargo, case-insensitive", () => {
    expect(filterEmployees(base, "ana")).toHaveLength(1);
    expect(filterEmployees(base, "22-2")).toHaveLength(1);
    expect(filterEmployees(base, "jefe")).toHaveLength(1);
    expect(filterEmployees(base, "")).toHaveLength(2);
    expect(filterEmployees(base, "zzz")).toHaveLength(0);
  });
});
