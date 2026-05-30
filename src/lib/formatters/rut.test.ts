/* Tests de formatRut — normalización + formateo de RUT chileno.
   Anti-regresión: el RUT es identidad crítica en Qavante (login, SII,
   credenciales). Cualquier cambio en la normalización debe ser deliberado. */
import { describe, expect, it } from "vitest";
import { formatRut } from "./rut";

describe("formatRut", () => {
  it("formatea un RUT crudo de 9 dígitos a NN.NNN.NNN-D", () => {
    expect(formatRut("123456789")).toBe("12.345.678-9");
  });

  it("es idempotente: un RUT ya formateado vuelve igual", () => {
    expect(formatRut("12.345.678-9")).toBe("12.345.678-9");
  });

  it("normaliza el dígito verificador 'k' a mayúscula", () => {
    expect(formatRut("12345678k")).toBe("12.345.678-K");
    expect(formatRut("12345678K")).toBe("12.345.678-K");
  });

  it("ignora puntos, guiones y espacios del input", () => {
    expect(formatRut("12.345.678-9")).toBe("12.345.678-9");
    expect(formatRut("12 345 678 9")).toBe("12.345.678-9");
    expect(formatRut("12-345-678-9")).toBe("12.345.678-9");
  });

  it("agrupa de a 3 desde la derecha según el largo del cuerpo", () => {
    expect(formatRut("7654321-0")).toBe("7.654.321-0"); // cuerpo 7 dígitos
    expect(formatRut("1234567-8")).toBe("1.234.567-8");
    expect(formatRut("111")).toBe("11-1"); // cuerpo 2 dígitos, sin puntos
  });

  it("devuelve el input tal cual si tiene menos de 2 caracteres útiles", () => {
    expect(formatRut("9")).toBe("9");
    expect(formatRut("")).toBe("");
  });

  it("maneja el RUT mínimo (1 dígito de cuerpo + DV)", () => {
    expect(formatRut("1-9")).toBe("1-9");
    expect(formatRut("19")).toBe("1-9");
  });

  it("no inserta separadores de más en cuerpos múltiplo de 3", () => {
    expect(formatRut("123456-7")).toBe("123.456-7"); // cuerpo 6 → 123.456
    expect(formatRut("100000000")).toBe("10.000.000-0");
  });
});
