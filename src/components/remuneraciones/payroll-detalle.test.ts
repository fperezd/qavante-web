import { describe, expect, it } from "vitest";
import {
  detalleCuadra,
  normalizePayrollDetalle,
  readPayrollObligaciones,
  sumCostoEmpresa,
  sumHaberes,
  sumLiquido,
  tieneCostoEmpresa,
  tieneHaberesPorEmpleado,
  type EmployeePayroll,
} from "./payroll-detalle";
import type { PayrollResponse } from "@/lib/api/buk";

function resp(detalle: unknown): PayrollResponse {
  return { status: "ok", period: "2026-03", detalle } as unknown as PayrollResponse;
}

describe("payroll-detalle · normalizePayrollDetalle", () => {
  it("sin `detalle` (backend aún no lo expone) → []", () => {
    expect(normalizePayrollDetalle(undefined)).toEqual([]);
    expect(normalizePayrollDetalle({ status: "ok" } as PayrollResponse)).toEqual([]);
  });

  it("lee employee_id/nombre/rut/haberes/costo_empresa/liquido", () => {
    const rows = normalizePayrollDetalle(
      resp([
        {
          employee_id: 7,
          nombre: "Ana Pérez",
          rut: "12.345.678-9",
          total_haberes: 1100000,
          costo_empresa: 1300000,
          liquido: 850000,
        },
      ]),
    );
    expect(rows).toEqual([
      {
        id: "7",
        nombre: "Ana Pérez",
        rut: "12.345.678-9",
        haberes: 1100000,
        costoEmpresa: 1300000,
        liquido: 850000,
      },
    ]);
  });

  it("tolera nombres alternativos (id/full_name/monto_liquido/haberes)", () => {
    const rows = normalizePayrollDetalle(
      resp([{ id: "9", full_name: "Beto", haberes: 900000, monto_liquido: 700000 }]),
    );
    expect(rows[0]).toEqual({
      id: "9",
      nombre: "Beto",
      rut: null,
      haberes: 900000,
      costoEmpresa: null,
      liquido: 700000,
    });
  });

  it("tolera haberes/costo/líquido/rut ausentes → null (el detalle solo trae líquido)", () => {
    const rows = normalizePayrollDetalle(resp([{ employee_id: 1, nombre: "X", liquido: 500000 }]));
    expect(rows[0]?.haberes).toBeNull();
    expect(rows[0]?.costoEmpresa).toBeNull();
    const sinLiquido = normalizePayrollDetalle(resp([{ employee_id: 1, nombre: "X" }]));
    expect(sinLiquido[0]?.liquido).toBeNull();
    expect(sinLiquido[0]?.rut).toBeNull();
  });
});

describe("payroll-detalle · haberes por empleado", () => {
  const conHaberes: EmployeePayroll[] = [
    { id: "1", nombre: "A", rut: null, haberes: 600000, costoEmpresa: null, liquido: 500000 },
    { id: "2", nombre: "B", rut: null, haberes: 400000, costoEmpresa: null, liquido: 300000 },
    { id: "3", nombre: "C", rut: null, haberes: null, costoEmpresa: null, liquido: null },
  ];
  const soloLiquido: EmployeePayroll[] = [
    { id: "1", nombre: "A", rut: null, haberes: null, costoEmpresa: null, liquido: 500000 },
  ];

  it("tieneHaberesPorEmpleado: true si al menos uno trae haberes", () => {
    expect(tieneHaberesPorEmpleado(conHaberes)).toBe(true);
    expect(tieneHaberesPorEmpleado(soloLiquido)).toBe(false);
    expect(tieneHaberesPorEmpleado([])).toBe(false);
  });

  it("sumHaberes ignora nulls", () => {
    expect(sumHaberes(conHaberes)).toBe(1000000);
    expect(sumHaberes(soloLiquido)).toBe(0);
  });
});

describe("payroll-detalle · costo empresa por empleado", () => {
  const conCosto: EmployeePayroll[] = [
    { id: "1", nombre: "A", rut: null, haberes: null, costoEmpresa: 700000, liquido: 500000 },
    { id: "2", nombre: "B", rut: null, haberes: null, costoEmpresa: 500000, liquido: 300000 },
    { id: "3", nombre: "C", rut: null, haberes: null, costoEmpresa: null, liquido: null },
  ];
  const sinCosto: EmployeePayroll[] = [
    { id: "1", nombre: "A", rut: null, haberes: null, costoEmpresa: null, liquido: 500000 },
  ];

  it("tieneCostoEmpresa: true si al menos uno trae costo empresa", () => {
    expect(tieneCostoEmpresa(conCosto)).toBe(true);
    expect(tieneCostoEmpresa(sinCosto)).toBe(false);
    expect(tieneCostoEmpresa([])).toBe(false);
  });

  it("sumCostoEmpresa ignora nulls", () => {
    expect(sumCostoEmpresa(conCosto)).toBe(1200000);
    expect(sumCostoEmpresa(sinCosto)).toBe(0);
  });
});

describe("payroll-detalle · readPayrollObligaciones", () => {
  it("sin totales → ambos null (se muestra 'en preparación', no $0)", () => {
    expect(readPayrollObligaciones(undefined)).toEqual({ impuestoF29: null, previred: null });
    expect(readPayrollObligaciones({})).toEqual({ impuestoF29: null, previred: null });
  });

  it("lee los campos canónicos (total_impuesto / total_previred)", () => {
    expect(readPayrollObligaciones({ total_impuesto: 320000, total_previred: 1450000 })).toEqual({
      impuestoF29: 320000,
      previred: 1450000,
    });
  });

  it("tolera nombres alternativos (impuesto_unico / total_imposiciones)", () => {
    expect(readPayrollObligaciones({ impuesto_unico: 210000, total_imposiciones: 990000 })).toEqual(
      {
        impuestoF29: 210000,
        previred: 990000,
      },
    );
  });

  it("distingue 0 explícito (real) de ausente (null)", () => {
    expect(readPayrollObligaciones({ total_impuesto: 0 })).toEqual({
      impuestoF29: 0,
      previred: null,
    });
  });
});

describe("payroll-detalle · sumLiquido / detalleCuadra", () => {
  const rows: EmployeePayroll[] = [
    { id: "1", nombre: "A", rut: null, haberes: null, costoEmpresa: null, liquido: 500000 },
    { id: "2", nombre: "B", rut: null, haberes: null, costoEmpresa: null, liquido: 300000 },
    { id: "3", nombre: "C", rut: null, haberes: null, costoEmpresa: null, liquido: null },
  ];

  it("sumLiquido ignora nulls", () => {
    expect(sumLiquido(rows)).toBe(800000);
  });

  it("detalleCuadra: true cuando la suma == total (±1)", () => {
    expect(detalleCuadra(rows, 800000)).toBe(true);
    expect(detalleCuadra(rows, 800001)).toBe(true);
    expect(detalleCuadra(rows, 750000)).toBe(false);
  });

  it("detalleCuadra: false sin detalle o sin total", () => {
    expect(detalleCuadra([], 800000)).toBe(false);
    expect(detalleCuadra(rows, undefined)).toBe(false);
  });
});
