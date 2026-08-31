import { describe, expect, it } from "vitest";
import { alreadyExistLabel } from "./apply-template-dialog";

/* Concordancia N=1 (issue #94): una empresa con sólo 1 cuenta o 1 vista YA existente (plantilla
 * casi nueva para ella) es el caso real. El defecto vivo escribía "1 cuentas y 1 vistas ya
 * existen". */
describe("alreadyExistLabel", () => {
  it("ambos en 1: singular en los dos sustantivos", () => {
    expect(alreadyExistLabel(1, 1)).toBe("1 cuenta y 1 vista ya existen, se respetan sin cambios.");
    expect(alreadyExistLabel(1, 1)).not.toContain("1 cuentas");
    expect(alreadyExistLabel(1, 1)).not.toContain("1 vistas");
  });

  /* [control positivo] gemelo N≠1: si un mutante forzara siempre el singular, este assert lo mata. */
  it("[control positivo] ambos en varios: plural en los dos", () => {
    expect(alreadyExistLabel(2, 6)).toBe(
      "2 cuentas y 6 vistas ya existen, se respetan sin cambios.",
    );
  });

  it("mixto: 1 cuenta pero varias vistas — cada sustantivo concuerda por SU PROPIO número", () => {
    expect(alreadyExistLabel(1, 3)).toBe(
      "1 cuenta y 3 vistas ya existen, se respetan sin cambios.",
    );
  });
});
