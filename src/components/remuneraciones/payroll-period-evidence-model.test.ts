import { describe, expect, it } from "vitest";
import { allocationCoverageCopy, periodStateCopy } from "./payroll-evidence-model";

/* El modelo puro del PERÍODO (#203). Lo que fija: ningún estado no confirmado se traduce a una
   frase que rotule el período como pagado, y un código que el backend agregue se nombra igual
   en vez de desaparecer. */

describe("periodStateCopy", () => {
  it("un pago observado y no confirmado NO cuenta como pagado", () => {
    const copy = periodStateCopy("observed_unconfirmed");
    expect(copy.countsAsPaid).toBe(false);
    expect(copy.label).toBe("Pago observado, por verificar");
    expect(copy.tone).not.toBe("confirmed");
  });

  it("GEMELO: un pago confirmado SÍ cuenta como pagado", () => {
    const copy = periodStateCopy("confirmed_paid");
    expect(copy.countsAsPaid).toBe(true);
    expect(copy.tone).toBe("confirmed");
  });

  it("ningún estado fuera de confirmed_paid cuenta como pagado", () => {
    for (const state of [
      "accrued_liquid",
      "observed_unconfirmed",
      "confirmed_outstanding",
      "conflict",
    ]) {
      expect(periodStateCopy(state).countsAsPaid, state).toBe(false);
    }
  });

  it("un estado que el backend agregue se declara sin interpretarlo", () => {
    const copy = periodStateCopy("un_estado_nuevo");
    expect(copy.countsAsPaid).toBe(false);
    expect(copy.label).toBe("Estado que esta pantalla no traduce");
  });

  it("GEMELO: los estados conocidos no caen al fallback", () => {
    expect(periodStateCopy("conflict").label).not.toBe("Estado que esta pantalla no traduce");
  });
});

describe("allocationCoverageCopy", () => {
  it("unallocated dice que no alcanza para nombrar a nadie", () => {
    expect(allocationCoverageCopy("unallocated").detail).toContain(
      "no alcanza para nombrar a nadie",
    );
  });

  it("GEMELO: full dice que está repartido con nombre y RUT", () => {
    expect(allocationCoverageCopy("full").detail).toContain("nombre y RUT");
  });

  it("una cobertura que el backend agregue se nombra igual", () => {
    expect(allocationCoverageCopy("algo_nuevo").label).toContain("algo_nuevo");
  });

  it("GEMELO: sin cobertura declarada lo dice, no la inventa", () => {
    expect(allocationCoverageCopy(null).label).toBe("Reparto que la lectura no declara");
  });
});
