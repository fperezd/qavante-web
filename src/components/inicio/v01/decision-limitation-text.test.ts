import { describe, expect, it } from "vitest";
import { decisionLimitationText } from "./decision-limitation-text";

describe("decisionLimitationText", () => {
  it("no borra advertencias desconocidas ni motivos técnicos sin equivalencia verificada", () => {
    for (const reason of ["Falta moneda", "Nueva restricción de cobro"]) {
      expect(decisionLimitationText(reason)).toBe(reason);
    }
  });

  it("traduce motivos técnicos conocidos antes de presentarlos", () => {
    expect(decisionLimitationText("source_stale:sii_rcv")).toBe(
      "Una o más fuentes pueden estar desactualizadas.",
    );
    expect(decisionLimitationText("missing_due_dates")).toBe(
      "Faltan fechas de vencimiento para completar la evaluación.",
    );
  });
});
