import { describe, it, expect } from "vitest";
import {
  countSignificantBefore,
  caretAfterSignificant,
  preservedCaret,
} from "./qavante-input-caret";

describe("countSignificantBefore", () => {
  it("currency: cuenta solo dígitos antes del caret", () => {
    // "$1.234" con caret en índice 3 ("$1." ) → 1 dígito
    expect(countSignificantBefore("currency", "$1.234", 3)).toBe(1);
    expect(countSignificantBefore("currency", "$1.234", 6)).toBe(4);
  });

  it("rut: cuenta dígitos + K", () => {
    // "12.345.678-K" caret al final → 8 dígitos + K = 9
    expect(countSignificantBefore("rut", "12.345.678-K", 12)).toBe(9);
    // caret tras "12." (índice 3) → 2 dígitos
    expect(countSignificantBefore("rut", "12.345.678-K", 3)).toBe(2);
  });

  it("clamp: upto fuera de rango o negativo", () => {
    expect(countSignificantBefore("currency", "123", 99)).toBe(3);
    expect(countSignificantBefore("currency", "123", -5)).toBe(0);
  });
});

describe("caretAfterSignificant", () => {
  it("currency: ubica el caret tras el N-ésimo dígito", () => {
    // "$15.234": tras 2 dígitos ("$15") → índice 3
    expect(caretAfterSignificant("currency", "$15.234", 2)).toBe(3);
  });

  it("count<=0 → 0", () => {
    expect(caretAfterSignificant("currency", "$1.234", 0)).toBe(0);
  });

  it("count mayor que los significativos → fin del string", () => {
    expect(caretAfterSignificant("currency", "$1.234", 99)).toBe(6);
  });

  it("rut: salta los separadores . y -", () => {
    // "1.234-5" tras 4 significativos ("1234") → índice 5 (antes del '-')
    expect(caretAfterSignificant("rut", "1.234-5", 4)).toBe(5);
  });
});

describe("preservedCaret — escenarios de edición en medio", () => {
  it("currency: insertar un dígito en medio mantiene el caret lógico", () => {
    // Mostrado "$1.234", caret tras "1" (idx 2), el user tipea "5":
    // raw = "$15.234", caret raw idx 3; reformatea a "$15.234".
    // Esperado: caret tras "15" → idx 3.
    expect(preservedCaret("currency", "$15.234", 3, "$15.234")).toBe(3);
  });

  it("rut: editar el cuerpo no manda el caret al verificador", () => {
    // raw "129.345.678-K" (insertó "9" tras "12"), caret raw idx 3 (tras el
    // "9" recién tipeado); reformatea a "129.345.678-K". Esperado: el caret
    // queda justo después del "9" → idx 3, no salta al verificador K.
    expect(preservedCaret("rut", "129.345.678-K", 3, "129.345.678-K")).toBe(3);
  });

  it("borrar todo → caret 0", () => {
    expect(preservedCaret("currency", "", 0, "")).toBe(0);
  });
});
