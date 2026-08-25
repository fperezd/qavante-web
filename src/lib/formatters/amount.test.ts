/* Tests del parser ÚNICO de los montos string-decimal del backend. Lo que
   protegen es la diferencia entre "cero" y "no se sabe": confundirlas es la
   pantalla afirmando plata que no tiene. */
import { describe, expect, it } from "vitest";
import { parseAmount, parseAmountOrNull } from "./amount";

describe("parseAmount", () => {
  it("string-decimal → number, con y sin decimales", () => {
    expect(parseAmount("18500000")).toBe(18500000);
    expect(parseAmount("-300000.5")).toBe(-300000.5);
  });

  it("vacío / null / undefined / basura → 0 (defensa de transporte)", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount("no-es-numero")).toBe(0);
  });
});

describe("parseAmountOrNull", () => {
  it("preserva el 'no se sabe' como null", () => {
    expect(parseAmountOrNull(null)).toBeNull();
    expect(parseAmountOrNull(undefined)).toBeNull();
    expect(parseAmountOrNull("")).toBeNull();
    expect(parseAmountOrNull("no-es-numero")).toBeNull();
  });

  it("un string EN BLANCO es 'no se sabe', no cero", () => {
    // `Number(" ")` da 0: sin el trim, un saldo en blanco se mostraría "$0".
    expect(parseAmountOrNull("   ")).toBeNull();
  });

  it("'0' es un cero VERIFICADO y se conserva como 0", () => {
    expect(parseAmountOrNull("0")).toBe(0);
    expect(parseAmountOrNull("0.00")).toBe(0);
  });

  it("un número real pasa igual que en parseAmount", () => {
    expect(parseAmountOrNull("1931152.70")).toBe(1931152.7);
  });
});
