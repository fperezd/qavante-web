import { describe, expect, it } from "vitest";
import { appliedSummaryLabel } from "./templates-gallery-view";

/* Concordancia N=1 (issue #94): una plantilla que sólo agrega 1 cuenta o 1 vista nueva es el caso
 * real de una empresa casi completa, no de laboratorio. El defecto vivo escribía
 * "1 cuentas y 1 vistas nuevas se agregaron". */
describe("appliedSummaryLabel", () => {
  it("ambos en 1: singular en los dos sustantivos (y el adjetivo de 'vista nueva')", () => {
    expect(appliedSummaryLabel(1, 1)).toBe(
      "Plantilla aplicada. 1 cuenta y 1 vista nueva se agregaron a tu empresa.",
    );
    expect(appliedSummaryLabel(1, 1)).not.toContain("1 cuentas");
    expect(appliedSummaryLabel(1, 1)).not.toContain("1 vistas nuevas");
  });

  /* [control positivo] gemelo N≠1 para los dos campos: si un mutante forzara siempre el
   * singular, este assert lo mata. */
  it("[control positivo] ambos en varios: plural en los dos", () => {
    expect(appliedSummaryLabel(3, 5)).toBe(
      "Plantilla aplicada. 3 cuentas y 5 vistas nuevas se agregaron a tu empresa.",
    );
  });

  it("mixto: 1 cuenta pero varias vistas — cada sustantivo concuerda por SU PROPIO número", () => {
    expect(appliedSummaryLabel(1, 4)).toBe(
      "Plantilla aplicada. 1 cuenta y 4 vistas nuevas se agregaron a tu empresa.",
    );
  });

  it("cero: plural ('0 cuentas' es correcto en español)", () => {
    expect(appliedSummaryLabel(0, 0)).toBe(
      "Plantilla aplicada. 0 cuentas y 0 vistas nuevas se agregaron a tu empresa.",
    );
  });
});
