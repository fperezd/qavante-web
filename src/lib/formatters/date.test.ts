/* Tests de caracterización de formatDate — fecha corta es-CL (dd-mm-aaaa).
   Envuelve Intl.DateTimeFormat es-CL. Las fechas se construyen con
   componentes locales + mediodía para evitar corrimientos por timezone. */
import { describe, expect, it } from "vitest";
import { formatDate, formatDateLike } from "./date";

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

describe("formatDateLike — convención mes-año / DD-MM-AAAA (string in, string out)", () => {
  it("ISO date YYYY-MM-DD → DD-MM-AAAA", () => {
    expect(formatDateLike("2026-05-13")).toBe("13-05-2026");
  });

  it("ISO datetime → DD-MM-AAAA (toma la parte de fecha)", () => {
    expect(formatDateLike("2026-05-13T12:00:00Z")).toBe("13-05-2026");
  });

  it("año-mes YYYY-MM → MM-AAAA", () => {
    expect(formatDateLike("2026-05")).toBe("05-2026");
  });

  it("es idempotente: un valor ya en DD-MM-AAAA queda igual", () => {
    expect(formatDateLike("13-05-2026")).toBe("13-05-2026");
  });

  it("pasa por alto formatos desconocidos (ej. DD/MM/YYYY del SII)", () => {
    expect(formatDateLike("13/05/2026")).toBe("13/05/2026");
  });

  it("null / undefined / vacío → guion", () => {
    expect(formatDateLike(null)).toBe("—");
    expect(formatDateLike(undefined)).toBe("—");
    expect(formatDateLike("")).toBe("—");
  });
});
