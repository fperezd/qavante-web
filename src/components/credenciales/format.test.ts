/* Tests para los helpers de formato es-CL de credenciales. Anti-regresión
   contra cambios accidentales de formato (Anexo F voice & tone fija el
   "13 de mayo de 2026" largo y "13 may 2026" corto). */

import { describe, expect, it } from "vitest";
import { formatDateEsCL, formatDateShortEsCL, daysUntil } from "./format";

describe("format.ts — fechas es-CL", () => {
  it("formatDateEsCL devuelve formato largo en español", () => {
    expect(formatDateEsCL("2026-05-13T00:00:00Z")).toMatch(/\d{1,2} de \w+ de 2026/);
  });

  it("formatDateShortEsCL devuelve formato corto en español", () => {
    /* Acepta "13 may 2026" o "13 may. 2026" (con o sin punto) según versión
       de date-fns/locale. */
    expect(formatDateShortEsCL("2026-05-13T00:00:00Z")).toMatch(/\d{1,2} \w{3,4}\.? 2026/);
  });

  it("formatDateEsCL con input inválido devuelve el string original (fallback)", () => {
    expect(formatDateEsCL("no-es-fecha")).toBe("no-es-fecha");
  });

  it("daysUntil devuelve 0 o cercano para fechas de hoy", () => {
    const today = new Date().toISOString();
    const days = daysUntil(today);
    expect(days).toBeGreaterThanOrEqual(-1);
    expect(days).toBeLessThanOrEqual(1);
  });

  it("daysUntil devuelve positivo para fechas futuras", () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntil(future)).toBeGreaterThanOrEqual(9);
  });

  it("daysUntil devuelve negativo para fechas pasadas", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntil(past)).toBeLessThanOrEqual(-9);
  });
});
