import { describe, expect, it } from "vitest";
import { decisionLimitationText } from "./decision-limitation-text";

describe("decisionLimitationText", () => {
  it("no borra advertencias desconocidas ni motivos técnicos sin equivalencia verificada", () => {
    for (const reason of ["source_stale:sii_rcv", "Falta moneda", "Nueva restricción de cobro"]) {
      expect(decisionLimitationText(reason)).toBe(reason);
    }
  });
});
