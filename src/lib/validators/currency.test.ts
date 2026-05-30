/* Tests de isClpAmount — guard de monto CLP. Caracteriza el contrato real:
   acepta cualquier número finito (incluido 0 y negativos); rechaza NaN e
   Infinitos. NO valida signo ni rango (eso es responsabilidad de quien
   llama, no de este guard). */
import { describe, expect, it } from "vitest";
import { isClpAmount } from "./currency";

describe("isClpAmount", () => {
  it("acepta enteros finitos, incluido el cero", () => {
    expect(isClpAmount(0)).toBe(true);
    expect(isClpAmount(1000)).toBe(true);
    expect(isClpAmount(999999999)).toBe(true);
  });

  it("acepta decimales y negativos (no valida signo ni redondeo)", () => {
    expect(isClpAmount(1234.56)).toBe(true);
    expect(isClpAmount(-5000)).toBe(true);
  });

  it("rechaza NaN", () => {
    expect(isClpAmount(NaN)).toBe(false);
  });

  it("rechaza Infinity y -Infinity", () => {
    expect(isClpAmount(Infinity)).toBe(false);
    expect(isClpAmount(-Infinity)).toBe(false);
  });
});
