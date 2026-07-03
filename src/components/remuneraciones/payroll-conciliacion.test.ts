import { describe, expect, it } from "vitest";
import {
  matchPayrollToBank,
  resumenConciliacion,
  type BankDebitLike,
} from "./payroll-conciliacion";
import type { EmployeePayroll } from "./payroll-detalle";

const emp = (id: string, nombre: string, liquido: number | null): EmployeePayroll => ({
  id,
  nombre,
  rut: null,
  liquido,
});
const deb = (id: string, amount: string | number, direction = "debit"): BankDebitLike => ({
  id,
  amount,
  direction,
});

describe("payroll-conciliacion · matchPayrollToBank", () => {
  it("matchea líquido con débito del mismo monto", () => {
    const r = matchPayrollToBank([emp("1", "Ana", 850000)], [deb("d1", "850000")]);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]?.movimiento.id).toBe("d1");
    expect(r.unmatchedEmpleados).toHaveLength(0);
    expect(r.unmatchedDebitos).toHaveLength(0);
  });

  it("1-a-1: dos empleados con el MISMO líquido usan dos débitos distintos", () => {
    const r = matchPayrollToBank(
      [emp("1", "Ana", 500000), emp("2", "Beto", 500000)],
      [deb("d1", "500000"), deb("d2", "500000")],
    );
    expect(r.matched).toHaveLength(2);
    expect(new Set(r.matched.map((m) => m.movimiento.id)).size).toBe(2);
  });

  it("empleado sin débito → unmatchedEmpleados; débito sin empleado → unmatchedDebitos", () => {
    const r = matchPayrollToBank(
      [emp("1", "Ana", 500000), emp("2", "Beto", 999999)],
      [deb("d1", "500000"), deb("d2", "123456")],
    );
    expect(r.matched.map((m) => m.empleado.nombre)).toEqual(["Ana"]);
    expect(r.unmatchedEmpleados.map((e) => e.nombre)).toEqual(["Beto"]);
    expect(r.unmatchedDebitos.map((d) => d.id)).toEqual(["d2"]);
  });

  it("tolera monto negativo y numérico (magnitud)", () => {
    const r = matchPayrollToBank([emp("1", "Ana", 500000)], [deb("d1", -500000), deb("d2", 500000)]);
    expect(r.matched).toHaveLength(1); // toma el primero por magnitud
  });

  it("ignora créditos (solo débitos son pago de sueldo)", () => {
    const r = matchPayrollToBank([emp("1", "Ana", 500000)], [deb("d1", "500000", "credit")]);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatchedEmpleados).toHaveLength(1);
    expect(r.unmatchedDebitos).toHaveLength(0); // el crédito no cuenta como débito
  });

  it("empleado con líquido null nunca matchea", () => {
    const r = matchPayrollToBank([emp("1", "Ana", null)], [deb("d1", "500000")]);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatchedEmpleados).toHaveLength(1);
    expect(r.unmatchedDebitos).toHaveLength(1);
  });
});

describe("payroll-conciliacion · resumenConciliacion", () => {
  it("cuenta conciliados, pendientes, monto y débitos sin asignar", () => {
    const r = matchPayrollToBank(
      [emp("1", "Ana", 500000), emp("2", "Beto", 300000), emp("3", "Cata", 111111)],
      [deb("d1", "500000"), deb("d2", "300000"), deb("d3", "888888")],
    );
    const s = resumenConciliacion(r);
    expect(s).toEqual({
      conciliados: 2,
      totalEmpleados: 3,
      montoConciliado: 800000,
      empleadosPendientes: 1,
      debitosSinAsignar: 1,
    });
  });
});
