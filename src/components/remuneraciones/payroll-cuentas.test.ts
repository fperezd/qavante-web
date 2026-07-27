import { describe, it, expect } from "vitest";
import type { ManagementAccountNode } from "@/lib/api/management";
import { payrollCuentaOptions, agruparCuentaOptions } from "./payroll-cuentas";

function node(over: Partial<ManagementAccountNode>): ManagementAccountNode {
  return {
    id: over.code ?? "x",
    code: "x",
    name: "X",
    type: "operating_expense",
    parent_id: null,
    destination: "operational_income_statement",
    display_name: null,
    description: null,
    level: 1,
    path: null,
    sort_order: 0,
    is_system: false,
    is_visible: true,
    affects_pulso: false,
    active: true,
    metadata: null,
    children: [],
    ...over,
  } as ManagementAccountNode;
}

describe("payrollCuentaOptions", () => {
  it("solo incluye direct_cost (costo) y operating_expense (gasto), ignorando el resto del plan", () => {
    const tree = [
      node({ code: "income.sales", type: "income", name: "Ventas" }),
      node({ code: "direct_cost.direct_labor", type: "direct_cost", name: "Mano de obra directa" }),
      node({
        code: "operating_expense.admin_payroll",
        type: "operating_expense",
        name: "Remuneraciones administración",
      }),
    ];
    const opts = payrollCuentaOptions(tree);
    expect(opts.map((o) => o.code)).toEqual([
      "direct_cost.direct_labor",
      "operating_expense.admin_payroll",
    ]);
    expect(opts.find((o) => o.code === "direct_cost.direct_labor")?.grupo).toBe("costo");
    expect(opts.find((o) => o.code === "operating_expense.admin_payroll")?.grupo).toBe("gasto");
  });

  it("recorre hijos y omite inactivas / no visibles", () => {
    const tree = [
      node({
        code: "direct_cost",
        type: "direct_cost",
        name: "Costos directos",
        children: [
          node({ code: "direct_cost.direct_labor", type: "direct_cost", name: "MO directa" }),
          node({
            code: "direct_cost.oculta",
            type: "direct_cost",
            name: "Oculta",
            is_visible: false,
          }),
          node({
            code: "direct_cost.inactiva",
            type: "direct_cost",
            name: "Inactiva",
            active: false,
          }),
        ],
      }),
    ];
    const opts = payrollCuentaOptions(tree);
    expect(opts.map((o) => o.code)).toEqual(["direct_cost", "direct_cost.direct_labor"]);
  });

  it("usa display_name cuando existe, si no name", () => {
    const opts = payrollCuentaOptions([
      node({
        code: "direct_cost.direct_labor",
        type: "direct_cost",
        name: "MO",
        display_name: "Mano de obra directa",
      }),
    ]);
    expect(opts[0]?.label).toBe("Mano de obra directa");
  });
});

describe("agruparCuentaOptions", () => {
  it("agrupa en costo y gasto, y omite grupos vacíos", () => {
    const grupos = agruparCuentaOptions([
      { code: "a", label: "A", grupo: "gasto" },
      { code: "b", label: "B", grupo: "gasto" },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.grupo).toBe("gasto");
    expect(grupos[0]?.options.map((o) => o.code)).toEqual(["a", "b"]);
  });

  it("mantiene el orden costo → gasto", () => {
    const grupos = agruparCuentaOptions([
      { code: "g", label: "G", grupo: "gasto" },
      { code: "c", label: "C", grupo: "costo" },
    ]);
    expect(grupos.map((g) => g.grupo)).toEqual(["costo", "gasto"]);
  });
});
