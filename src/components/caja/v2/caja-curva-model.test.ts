import { describe, it, expect } from "vitest";
import { saldoAcumulado, primerCruce, indiceMasBajo } from "./caja-curva-model";

describe("saldoAcumulado", () => {
  it("acumula los netos sobre el saldo inicial", () => {
    expect(saldoAcumulado(1000, [-300, +200, -500])).toEqual([700, 900, 400]);
  });
  it("serie vacía → []", () => {
    expect(saldoAcumulado(1000, [])).toEqual([]);
  });
  it("tolera netos no finitos (los trata como 0)", () => {
    expect(saldoAcumulado(500, [NaN, -100])).toEqual([500, 400]);
  });
});

describe("primerCruce", () => {
  it("devuelve el primer índice bajo el mínimo", () => {
    expect(primerCruce([700, 900, 400, 600], 500)).toBe(2); // 400 < 500
  });
  it("null si nunca cruza", () => {
    expect(primerCruce([700, 900, 600], 500)).toBeNull();
  });
  it("estricto: igual al mínimo NO es cruce", () => {
    expect(primerCruce([700, 500, 600], 500)).toBeNull();
  });
});

describe("indiceMasBajo", () => {
  it("índice del saldo mínimo", () => {
    expect(indiceMasBajo([700, 900, 400, 600])).toBe(2);
  });
  it("empate → el primero", () => {
    expect(indiceMasBajo([400, 900, 400])).toBe(0);
  });
  it("vacío → null", () => {
    expect(indiceMasBajo([])).toBeNull();
  });
});
