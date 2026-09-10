import { describe, expect, it } from "vitest";
import type { PayrollTotales } from "@/lib/api/buk";
import type { EmployeePayroll } from "../payroll-detalle";
import type { SettlementBoard } from "../settlement-board-model";
import {
  ESTADO_LABEL,
  periodoDefaultV16,
  personasProtegidas,
  personasV16,
  resumenPersonas,
  triadaV16,
} from "./remuneraciones-v16-model";

/* Fixtures inventadas con la forma del contrato (`PayrollTotales` de `src/lib/api/types.ts`).
 * Nombres y RUTs ficticios — nunca datos de un tenant real (regla de PII de la vista). */

const TOTALES: PayrollTotales = {
  total_haberes: 20_500_000,
  total_descuentos: 5_252_241,
  total_liquido: 15_247_759,
  total_imponible: 18_900_000,
  empleados_contados: 8,
  total_cotizaciones: 3_809_631,
};

const EMPLEADO_A: EmployeePayroll = {
  id: "1",
  nombre: "Javiera Rojas",
  rut: "11111111-1",
  haberes: 3_200_000,
  costoEmpresa: 3_950_000,
  liquido: 2_850_000,
};
const EMPLEADO_B: EmployeePayroll = {
  id: "2",
  nombre: "Matías Soto",
  rut: "22222222-2",
  haberes: 2_950_000,
  costoEmpresa: 3_640_000,
  liquido: 2_610_000,
};
const EMPLEADO_C: EmployeePayroll = {
  id: "3",
  nombre: "Camila Núñez",
  rut: "33333333-3",
  haberes: null, // el conector no siempre trae haberes por persona
  costoEmpresa: 2_780_000,
  liquido: 2_245_500,
};

const DETALLE: EmployeePayroll[] = [EMPLEADO_A, EMPLEADO_B, EMPLEADO_C];

/* La suma de `costoEmpresa` del detalle (10.370.000) es DELIBERADAMENTE distinta de
 * líquido + cotizaciones (15.247.759 + 3.809.631 = 19.057.390): son dos números reales de dos
 * mundos distintos (BUK per-persona vs. agregados), y el punto de la trampa #1 es que la vista
 * NUNCA debe confundirlos. */
const SUMA_COSTO_EMPRESA_DETALLE = 3_950_000 + 3_640_000 + 2_780_000; // 10.370.000
const LIQUIDO_MAS_COTIZACIONES = 15_247_759 + 3_809_631; // 19.057.390

describe("periodoDefaultV16 — el último mes cerrado", () => {
  it("agosto en curso → julio", () => {
    expect(periodoDefaultV16(new Date("2026-08-30T15:00:00Z"))).toBe("2026-07");
  });
  it("enero en curso → diciembre del año anterior", () => {
    expect(periodoDefaultV16(new Date("2026-01-15T15:00:00Z"))).toBe("2025-12");
  });
});

describe("triadaV16 — sin planilla del período", () => {
  it("null cuando no hay líquido ni dotación (nada que mostrar)", () => {
    const vacio: PayrollTotales = {
      total_haberes: 0,
      total_descuentos: 0,
      total_liquido: 0,
      total_imponible: 0,
      empleados_contados: 0,
      total_cotizaciones: 0,
    };
    expect(triadaV16("2026-07", vacio, [], 30_000_000)).toBeNull();
  });

  it("null cuando totales es undefined (período no consultado / sin respuesta)", () => {
    expect(triadaV16("2026-07", undefined, [], 30_000_000)).toBeNull();
  });

  /* Mutante nulo de control: con datos normales (líquido y dotación positivos) la tríada NO
   * puede ser null. Si este test muere, el arnés de "sin planilla" de arriba no prueba nada real
   * (podría estar devolviendo null siempre). */
  it("[control] NO es null cuando hay líquido y dotación", () => {
    expect(triadaV16("2026-07", TOTALES, DETALLE, 30_000_000)).not.toBeNull();
  });
});

describe("triadaV16 — Líquido y Cotizaciones (Ley 1: misma fuente que la Planilla clásica)", () => {
  it("líquido = totales.total_liquido tal cual", () => {
    expect(triadaV16("2026-07", TOTALES, DETALLE, null)?.liquido).toBe(15_247_759);
  });

  it("cotizaciones = totales.total_cotizaciones (la MISMA cifra que Previred en Pagar)", () => {
    expect(triadaV16("2026-07", TOTALES, DETALLE, null)?.cotizaciones).toBe(3_809_631);
  });

  it("cotizacionesVencimiento = día 13 del mes siguiente", () => {
    expect(triadaV16("2026-07", TOTALES, DETALLE, null)?.cotizacionesVencimiento).toBe(
      "2026-08-13",
    );
  });

  it("cotizaciones null cuando el conector no trae el campo (nunca $0 inventado)", () => {
    /* `readPayrollObligaciones` lee `total_cotizaciones` tolerando su ausencia: si el campo
     * directamente no viene en la forma esperada, el resultado es "no sé" (null), no un cero
     * fabricado. Un 0 real del backend SÍ se respetaría como cero verificado — eso ya lo cubre
     * `payroll-detalle.test.ts`; acá se prueba el caso de campo ausente. */
    const totalesSinCampo = { ...TOTALES } as unknown as Record<string, unknown>;
    delete totalesSinCampo.total_cotizaciones;
    expect(
      triadaV16("2026-07", totalesSinCampo as unknown as PayrollTotales, DETALLE, null)
        ?.cotizaciones,
    ).toBeNull();
  });
});

describe("triadaV16 — costo empresa NO duplica cotizaciones (TRAMPA #1, ADR-0056/ADR-0070)", () => {
  it("costo empresa = suma del detalle por persona, NO líquido + cotizaciones", () => {
    const t = triadaV16("2026-07", TOTALES, DETALLE, null);
    expect(t?.costoEmpresa).toBe(SUMA_COSTO_EMPRESA_DETALLE);
    /* La guarda explícita: si alguien "simplifica" la fórmula a líquido + cotizaciones, este
     * assert se vuelve falso (10.370.000 ≠ 19.057.390) y el test cae. */
    expect(t?.costoEmpresa).not.toBe(LIQUIDO_MAS_COTIZACIONES);
  });

  it("costo empresa es null sin detalle por empleado — JAMÁS cae a líquido + cotizaciones", () => {
    const t = triadaV16("2026-07", TOTALES, [], null);
    expect(t?.costoEmpresa).toBeNull();
    /* Repetido a propósito como aserción independiente: null !== 19.057.390 ya lo prueba
     * `toBeNull()`, pero se deja explícito el número que NO debe aparecer si alguien agrega un
     * fallback silencioso más adelante. */
    expect(t?.costoEmpresa).not.toBe(LIQUIDO_MAS_COTIZACIONES);
  });

  it("costo empresa es null cuando NINGÚN empleado del detalle trae el campo", () => {
    const sinCosto: EmployeePayroll[] = DETALLE.map((e) => ({ ...e, costoEmpresa: null }));
    expect(triadaV16("2026-07", TOTALES, sinCosto, null)?.costoEmpresa).toBeNull();
  });
});

describe("triadaV16 — % de ingresos (ⓘ, sobre Costo empresa)", () => {
  it("costo empresa / ingresos del mismo período, en puntos porcentuales", () => {
    const t = triadaV16("2026-07", TOTALES, DETALLE, 21_250_000);
    // 10.370.000 / 21.250.000 = 48,8%
    expect(t?.costoEmpresaPctIngresos).toBeCloseTo(48.8, 1);
  });

  it("null sin ingresos del período (no 0%, no infinito)", () => {
    expect(triadaV16("2026-07", TOTALES, DETALLE, null)?.costoEmpresaPctIngresos).toBeNull();
  });

  it("null sin costo empresa, aunque haya ingresos", () => {
    expect(triadaV16("2026-07", TOTALES, [], 21_250_000)?.costoEmpresaPctIngresos).toBeNull();
  });

  it("null con ingresos en cero (evita división por cero)", () => {
    expect(triadaV16("2026-07", TOTALES, DETALLE, 0)?.costoEmpresaPctIngresos).toBeNull();
  });
});

describe("personasV16 — pago individual no inferido desde un monto", () => {
  it("un detalle con líquidos repetidos sigue íntegramente no verificado", () => {
    const filas = personasV16(DETALLE, "2026-07");
    expect(filas.every((p) => p.estado === "sin_verificar")).toBe(true);
  });

  it("el set cerrado no permite afirmar Pagado o Pendiente sin asignación D14", () => {
    const filas = personasV16(DETALLE, "2026-07");
    for (const p of filas) expect(p.estado).toBe("sin_verificar");
  });

  it("ordena por líquido descendente", () => {
    const filas = personasV16(DETALLE, "2026-07");
    expect(filas.map((p) => p.nombre)).toEqual(["Javiera Rojas", "Matías Soto", "Camila Núñez"]);
  });

  it("el href de cada fila enlaza a la Planilla clásica del período", () => {
    const filas = personasV16(DETALLE, "2026-07");
    expect(filas.every((p) => p.href === "/remuneraciones?period=2026-07")).toBe(true);
  });

  it("líquidos repetidos sin link persistido no producen ningún pago confirmado", () => {
    const repetidos = [
      { ...EMPLEADO_A, liquido: 500_000 },
      { ...EMPLEADO_B, liquido: 500_000 },
    ];
    const board: SettlementBoard = {
      workers: [
        {
          workerRut: EMPLEADO_A.rut!,
          workerName: EMPLEADO_A.nombre,
          liquido: 500_000,
          paidAmount: 0,
          outstanding: 500_000,
          status: "pending",
        },
        {
          workerRut: EMPLEADO_B.rut!,
          workerName: EMPLEADO_B.nombre,
          liquido: 500_000,
          paidAmount: 0,
          outstanding: 500_000,
          status: "pending",
        },
      ],
      periodOutstanding: 1_000_000,
      links: [],
    };
    expect(personasV16(repetidos, "2026-07", board).map((p) => p.estado)).toEqual([
      "sin_verificar",
      "sin_verificar",
    ]);
  });

  it("conserva un link persistido confirmado para su trabajador", () => {
    const board: SettlementBoard = {
      workers: [
        {
          workerRut: EMPLEADO_A.rut!,
          workerName: EMPLEADO_A.nombre,
          liquido: 2_850_000,
          paidAmount: 2_850_000,
          outstanding: 0,
          status: "confirmed",
        },
      ],
      periodOutstanding: 0,
      links: [
        {
          linkId: "link-a",
          workerRut: EMPLEADO_A.rut!,
          workerName: EMPLEADO_A.nombre,
          amount: 2_850_000,
          bankMovementId: "bank-a",
          glosa: "",
          createdAt: "2026-07-31T00:00:00Z",
        },
      ],
    };
    expect(
      personasV16([EMPLEADO_A, EMPLEADO_B], "2026-07", board).find((p) => p.key === "1")?.estado,
    ).toBe("confirmado");
    expect(
      personasV16([EMPLEADO_A, EMPLEADO_B], "2026-07", board).find((p) => p.key === "2")?.estado,
    ).toBe("sin_verificar");
  });

  it("presenta parcial sólo con link persistido y una reversión sin link como no verificada", () => {
    const board: SettlementBoard = {
      workers: [
        {
          workerRut: EMPLEADO_A.rut!,
          workerName: EMPLEADO_A.nombre,
          liquido: 2_850_000,
          paidAmount: 500_000,
          outstanding: 2_350_000,
          status: "partial",
        },
        {
          workerRut: EMPLEADO_B.rut!,
          workerName: EMPLEADO_B.nombre,
          liquido: 2_610_000,
          paidAmount: 0,
          outstanding: 2_610_000,
          status: "reverted",
        },
      ],
      periodOutstanding: 4_960_000,
      links: [
        {
          linkId: "link-a",
          workerRut: EMPLEADO_A.rut!,
          workerName: EMPLEADO_A.nombre,
          amount: 500_000,
          bankMovementId: "bank-a",
          glosa: "",
          createdAt: "2026-07-31T00:00:00Z",
        },
      ],
    };
    const estados = personasV16([EMPLEADO_A, EMPLEADO_B], "2026-07", board).map((p) => p.estado);
    expect(estados).toContain("parcial");
    expect(estados).toContain("sin_verificar");
  });

  it("403 y error no se disfrazan de pago no verificado", () => {
    expect(personasV16([EMPLEADO_A], "2026-07", undefined, "forbidden")[0]?.estado).toBe(
      "sin_acceso",
    );
    expect(personasV16([EMPLEADO_A], "2026-07", undefined, "error")[0]?.estado).toBe("error");
  });
});

describe("ESTADO_LABEL", () => {
  it("declara que el pago individual no está corroborado", () => {
    expect(ESTADO_LABEL.sin_verificar).toMatch(/no verificado/i);
  });
});

describe("resumenPersonas", () => {
  it("cuenta por estado", () => {
    const filas = personasV16(DETALLE, "2026-07");
    const r = resumenPersonas(filas);
    expect(r).toEqual({ total: 3, sinVerificar: 3, confirmados: 0, parciales: 0 });
  });

  it("[control] arreglo vacío da todos los conteos en cero, no undefined", () => {
    expect(resumenPersonas([])).toEqual({
      total: 0,
      sinVerificar: 0,
      confirmados: 0,
      parciales: 0,
    });
  });
});

describe("personasProtegidas — brecha esperada del detalle owner-only (issue #727)", () => {
  it("la diferencia entre empleados_contados y las filas del detalle", () => {
    expect(personasProtegidas({ empleados: 8 }, 3)).toBe(5);
  });
  it("cero cuando el detalle trae a todos (o más, defensivo)", () => {
    expect(personasProtegidas({ empleados: 3 }, 3)).toBe(0);
    expect(personasProtegidas({ empleados: 2 }, 3)).toBe(0);
  });
  it("cero cuando no se sabe la dotación agregada (empleados null)", () => {
    expect(personasProtegidas({ empleados: null }, 3)).toBe(0);
  });
});
