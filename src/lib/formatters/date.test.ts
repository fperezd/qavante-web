/* Tests de caracterización de formatDate — fecha corta es-CL (dd-mm-aaaa).
   Envuelve Intl.DateTimeFormat es-CL. Las fechas se construyen con
   componentes locales + mediodía para evitar corrimientos por timezone. */
import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  it("usa el orden día-mes-año con guiones (es-CL)", () => {
    expect(formatDate(new Date(2026, 4, 30, 12, 0, 0))).toBe("30-05-2026");
  });

  it("rellena día y mes con cero a la izquierda", () => {
    expect(formatDate(new Date(2026, 0, 5, 12, 0, 0))).toBe("05-01-2026");
  });

  it("formatea diciembre (mes 12) correctamente", () => {
    expect(formatDate(new Date(2026, 11, 25, 12, 0, 0))).toBe("25-12-2026");
  });
});
