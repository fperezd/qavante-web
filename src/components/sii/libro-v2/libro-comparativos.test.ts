import { describe, it, expect } from "vitest";
import {
  pctCambio,
  promedio,
  netoDocs,
  netosYoY,
  diaDelMes,
  docsHastaDiaDelMes,
  calcularComparativos,
  nombreMes,
  planComparativoPeriodos,
} from "./libro-comparativos";
import type { RcvDoc } from "../rcv-grouped-item";

const fac = (neto: number, fecha: string): RcvDoc => ({
  tipo_doc: 33,
  monto_neto: neto,
  monto_iva: Math.round(neto * 0.19),
  monto_total: Math.round(neto * 1.19),
  fecha,
});
const nc = (neto: number, fecha: string): RcvDoc => ({
  tipo_doc: 61,
  monto_neto: neto,
  monto_iva: Math.round(neto * 0.19),
  monto_total: Math.round(neto * 1.19),
  fecha,
});

describe("pctCambio", () => {
  it("calcula el cambio porcentual", () => {
    expect(pctCambio(800, 1000)).toBeCloseTo(25);
    expect(pctCambio(1000, 800)).toBeCloseTo(-20);
  });
  it("null si la base no permite comparación (≤ 0)", () => {
    expect(pctCambio(0, 500)).toBeNull();
    expect(pctCambio(-100, 500)).toBeNull();
  });
  it("null si actual es negativo (degenerado: una baja no supera −100%)", () => {
    expect(pctCambio(1000, -500)).toBeNull(); // habría dado −150%
    expect(pctCambio(100, -593)).toBeNull(); // el caso real "−693%"
  });
  it("actual = 0 sí vale (= −100%, no vendió nada)", () => {
    expect(pctCambio(1000, 0)).toBe(-100);
  });
});

describe("promedio", () => {
  it("promedia; null si vacío", () => {
    expect(promedio([600, 800, 1000])).toBe(800);
    expect(promedio([])).toBeNull();
  });
});

describe("netoDocs", () => {
  it("netea las notas de crédito", () => {
    expect(netoDocs([fac(1000, "2026-07-01"), nc(300, "2026-07-05")])).toBe(700);
    expect(netoDocs([])).toBe(0);
  });
  it("incluye el exento (exportaciones) además del afecto", () => {
    const exp: RcvDoc = { tipo_doc: 110, monto_exento: 5000, fecha: "2026-07-03" };
    expect(netoDocs([fac(1000, "2026-07-01"), exp])).toBe(6000); // 1000 afecto + 5000 exento
  });
});

describe("diaDelMes", () => {
  it("extrae el día en cualquier formato del SII", () => {
    expect(diaDelMes("26/02/2026")).toBe(26);
    expect(diaDelMes("2026-02-11")).toBe(11);
    expect(diaDelMes("2026-02-11T12:00:00Z")).toBe(11);
  });
  it("null si falta o es inválida", () => {
    expect(diaDelMes(undefined)).toBeNull();
    expect(diaDelMes("no es fecha")).toBeNull();
  });
});

describe("docsHastaDiaDelMes", () => {
  it("filtra por día del mes ≤ límite (misma fecha)", () => {
    const docs = [fac(100, "2026-07-05"), fac(200, "2026-07-15"), fac(400, "2026-07-25")];
    expect(docsHastaDiaDelMes(docs, 15).map((d) => d.monto_neto)).toEqual([100, 200]);
  });
});

describe("calcularComparativos", () => {
  it("arma los tres comparativos cuando hay datos", () => {
    const out = calcularComparativos({
      mesActual: [fac(1000, "2026-07-10")],
      mesAnterior: [fac(800, "2026-06-10")],
      diaCorte: 15,
      netoMesAnterior: 900,
      netosDelAnio: [600, 800, 1000],
      labelMesAnterior: "julio",
      netoPeriodo: 5000,
      netoPeriodoAnioAnterior: 4000,
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ pct: expect.closeTo(25), label: "este mes vs. misma fecha del mes anterior" });
    expect(out[1]).toEqual({ pct: expect.closeTo(12.5), label: "julio sobre el promedio mensual del año" });
    expect(out[2]).toEqual({ pct: expect.closeTo(25), label: "vs. el mismo período del año anterior" });
  });

  it("omite el comparativo que no se puede calcular (degradado honesto)", () => {
    const out = calcularComparativos({
      netoPeriodo: 5000, // sin año anterior → YoY se omite
      mesActual: [fac(1000, "2026-07-10")], // sin mesAnterior → #1 se omite
    });
    expect(out).toEqual([]);
  });

  it("omite el YoY si la base del año anterior es 0", () => {
    const out = calcularComparativos({ netoPeriodo: 5000, netoPeriodoAnioAnterior: 0 });
    expect(out).toEqual([]);
  });

  it("respeta 'hasta la misma fecha' (no mes completo vs parcial)", () => {
    // mes actual: solo hasta el día 10; mes anterior tiene una venta tardía (día 25)
    // que NO debe contar → base = 800, no 1300.
    const out = calcularComparativos({
      mesActual: [fac(1000, "2026-07-05")],
      mesAnterior: [fac(800, "2026-06-05"), fac(500, "2026-06-25")],
      diaCorte: 10,
    });
    expect(out[0]?.pct).toBeCloseTo(25); // (1000-800)/800
  });
});

describe("netosYoY (mes en curso truncado a la fecha de corte)", () => {
  const byPeriod: Record<string, RcvDoc[]> = {
    "2026-06": [fac(1000, "2026-06-30")], // mes del rango, completo
    "2026-07": [fac(500, "2026-07-05"), fac(700, "2026-07-25")], // mes EN CURSO: solo el del día 5
    "2025-06": [fac(900, "2025-06-30")],
    "2025-07": [fac(400, "2025-07-05"), fac(600, "2025-07-25")], // jul del año pasado: solo el del día 5
  };
  const docsDe = (p: string) => byPeriod[p] ?? [];

  it("trunca el mes actual Y su contraparte del año pasado a diaCorte; el resto va completo", () => {
    const out = netosYoY(["2026-06", "2026-07"], ["2025-06", "2025-07"], docsDe, "2026-07", 10);
    expect(out.netoPeriodo).toBe(1500); // 1000 (jun) + 500 (jul ≤ día 10)
    expect(out.netoPeriodoAnioAnterior).toBe(1300); // 900 (jun) + 400 (jul ≤ día 10)
  });

  it("si el mes actual NO está en el rango, todos los meses van completos", () => {
    const out = netosYoY(["2026-06"], ["2025-06"], docsDe, "2026-07", 10);
    expect(out).toEqual({ netoPeriodo: 1000, netoPeriodoAnioAnterior: 900 });
  });
});

describe("nombreMes", () => {
  it("nombra el mes en español", () => {
    expect(nombreMes("2026-07")).toBe("julio");
    expect(nombreMes("2026-01")).toBe("enero");
    expect(nombreMes("2026-12")).toBe("diciembre");
  });
});

describe("planComparativoPeriodos", () => {
  it("planifica los meses a bajar para hoy 2026-07-15, rango feb–jul 2026", () => {
    const plan = planComparativoPeriodos(
      { desde: "2026-02", hasta: "2026-07" },
      new Date(2026, 6, 15), // jul = mes 6 (0-based)
    );
    expect(plan.mesActual).toBe("2026-07");
    expect(plan.mesAnterior).toBe("2026-06");
    expect(plan.diaCorte).toBe(15);
    expect(plan.labelMesAnterior).toBe("junio");
    expect(plan.mesesAnio).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(plan.rango).toEqual(["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
    expect(plan.rangoAnioAnterior).toEqual(["2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07"]);
    // Unión única y ordenada: 2025-02..07 (6) + 2026-01..07 (7) = 13.
    expect(plan.periodos).toHaveLength(13);
    expect(plan.periodos[0]).toBe("2025-02");
    expect(plan.periodos.at(-1)).toBe("2026-07");
    expect(new Set(plan.periodos).size).toBe(plan.periodos.length); // sin duplicados
  });

  it("en enero el promedio anual se degrada (mesesAnio vacío)", () => {
    const plan = planComparativoPeriodos(
      { desde: "2026-01", hasta: "2026-01" },
      new Date(2026, 0, 10), // enero
    );
    expect(plan.mesAnterior).toBe("2025-12");
    expect(plan.mesesAnio).toEqual([]); // mes anterior cae en 2025 → sin promedio del año en curso
  });
});
