import { describe, it, expect } from "vitest";
import {
  diaDelMes,
  ventasNetasHastaDia,
  ventasNetasTotal,
  type DocFechado,
} from "./comparativo-tramo";

const docs: DocFechado[] = [
  { fecha: "01/07/2026", tipo_doc: 33, monto_neto: 2_000_000 }, // día 1
  { fecha: "05/07/2026", tipo_doc: 33, monto_neto: 3_000_000 }, // día 5
  { fecha: "20/07/2026", tipo_doc: 34, monto_exento: 1_000_000 }, // día 20, exenta
  { fecha: "22/07/2026", tipo_doc: 61, monto_neto: 500_000 }, // día 22, NC → resta
];

describe("diaDelMes", () => {
  it("parsea DD/MM/YYYY e ISO; 99 si no parsea", () => {
    expect(diaDelMes("01/07/2026")).toBe(1);
    expect(diaDelMes("2026-07-05")).toBe(5);
    expect(diaDelMes("")).toBe(99);
    expect(diaDelMes(undefined)).toBe(99);
  });
});

describe("ventasNetasHastaDia", () => {
  it("corta por día del mes y netea NC (afecto + exento)", () => {
    expect(ventasNetasHastaDia(docs, 1)).toBe(2_000_000); // solo la del día 1
    expect(ventasNetasHastaDia(docs, 5)).toBe(5_000_000); // día 1 + día 5
    expect(ventasNetasHastaDia(docs, 20)).toBe(6_000_000); // + exenta $1M
    expect(ventasNetasHastaDia(docs, 31)).toBe(5_500_000); // + NC día 22 resta $500k
  });

  it("mes en curso vacío (sin ventas aún) → 0", () => {
    expect(ventasNetasHastaDia([], 15)).toBe(0);
  });
});

describe("ventasNetasTotal", () => {
  it("todo el mes, neteado", () => {
    expect(ventasNetasTotal(docs)).toBe(5_500_000); // 2M + 3M + 1M exento − 500k NC
  });
});
