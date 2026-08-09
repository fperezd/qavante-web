import { describe, it, expect } from "vitest";
import { heroPresupuesto, semaforoResultado, desviosPresupuesto } from "./presupuesto-model";
import type { PlanReal, PlanRealFila } from "@/components/inicio/v2/plan-real-model";

/* Modelo del hero de Presupuesto: deriva resultado real vs plan + semáforo + barras de gasto. */

function fila(
  concepto: PlanRealFila["concepto"],
  plan: number,
  real: number,
): PlanRealFila {
  const variacion = real - plan;
  return {
    concepto,
    label: concepto,
    plan,
    real,
    variacion,
    variacionPct: plan !== 0 ? Math.round((variacion / Math.abs(plan)) * 100) : null,
    favorable: variacion >= 0,
  };
}

function planReal(filas: PlanRealFila[]): PlanReal {
  return {
    periodoLabel: "agosto",
    tieneBudget: true,
    filas,
    resultado: filas.find((f) => f.concepto === "result") ?? null,
  };
}

describe("semaforoResultado", () => {
  it("favorable (≥ plan) → verde aunque la magnitud sea grande", () => {
    expect(semaforoResultado(5_000_000, 40)).toBe("good");
  });
  it("abajo del plan por umbrales: ≤5% verde, 5–15% amarillo, >15% rojo", () => {
    expect(semaforoResultado(-100, -3)).toBe("good");
    expect(semaforoResultado(-100, -10)).toBe("warn");
    expect(semaforoResultado(-100, -47)).toBe("bad");
  });
});

describe("heroPresupuesto", () => {
  it("deriva resultado real/plan + variación + barras de gasto (montos SIGNADOS)", () => {
    const pr = planReal([
      fila("revenue", 40_000_000, 44_300_000),
      fila("direct_cost", -30_000_000, -31_100_000),
      fila("operating_expense", -11_300_000, -11_800_000),
      fila("result", 2_700_000, 1_440_000),
    ]);
    const h = heroPresupuesto(pr)!;
    expect(h.resultadoReal).toBe(1_440_000);
    expect(h.resultadoPlan).toBe(2_700_000);
    expect(h.variacion).toBe(-1_260_000); // vas abajo
    expect(h.ventas).toBe(44_300_000);
    expect(h.gastoReal).toBe(42_900_000); // |−31,1M| + |−11,8M|
    expect(h.gastoPlan).toBe(41_300_000); // |−30M| + |−11,3M|
    expect(h.gastoOver).toBe(true); // gastó más de lo presupuestado
    expect(h.semaforo).toBe("bad"); // −47% del plan
  });

  it("null si no hay fila de resultado", () => {
    expect(heroPresupuesto(planReal([fila("revenue", 1, 1)]))).toBeNull();
  });
});

describe("desviosPresupuesto", () => {
  const pr = planReal([
    fila("revenue", 40_000_000, 44_300_000), // +4,3M a favor
    fila("direct_cost", -30_000_000, -31_100_000), // −1,1M en contra
    fila("operating_expense", -11_300_000, -11_800_000), // −0,5M en contra
    fila("result", 2_700_000, 1_440_000),
  ]);

  it("excluye el Resultado (es el total del hero) y devuelve una fila por concepto", () => {
    const d = desviosPresupuesto(pr);
    expect(d.map((x) => x.concepto)).not.toContain("result");
    expect(d).toHaveLength(3);
  });

  it("ordena EN CONTRA primero (por magnitud), a favor al final", () => {
    const d = desviosPresupuesto(pr);
    // direct_cost (−1,1M) antes que operating_expense (−0,5M); revenue (a favor) al final.
    expect(d.map((x) => x.concepto)).toEqual(["direct_cost", "operating_expense", "revenue"]);
    expect(d[0]!.favorable).toBe(false);
    expect(d.at(-1)!.favorable).toBe(true);
  });

  it("omite las líneas sin desvío (variación 0)", () => {
    const d = desviosPresupuesto(
      planReal([
        fila("revenue", 10_000_000, 10_000_000), // clavado → fuera
        fila("direct_cost", -5_000_000, -6_000_000),
        fila("result", 5_000_000, 4_000_000),
      ]),
    );
    expect(d.map((x) => x.concepto)).toEqual(["direct_cost"]);
  });
});
