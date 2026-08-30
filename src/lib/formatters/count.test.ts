import { describe, expect, it } from "vitest";
import { formatCount, formatDays } from "./count";

describe("formatCount", () => {
  it("separa los miles a la chilena y no inventa decimales", () => {
    expect(formatCount(3)).toBe("3");
    expect(formatCount(1234)).toBe("1.234");
    expect(formatCount(1234567)).toBe("1.234.567");
  });

  it("un conteo fraccionario se redondea al entero (no existen medios documentos)", () => {
    expect(formatCount(2.6)).toBe("3");
  });

  it("el cero es un valor REAL y se imprime", () => {
    expect(formatCount(0)).toBe("0");
  });

  it("un no-finito NO se imprime como número", () => {
    expect(formatCount(Number.NaN)).toBe("s/d");
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe("s/d");
  });
});

describe("formatDays", () => {
  it("plural por defecto, singular en el uno", () => {
    expect(formatDays(53)).toBe("53 días");
    expect(formatDays(1)).toBe("1 día");
    expect(formatDays(0)).toBe("0 días");
  });

  it("el negativo lleva el menos TIPOGRÁFICO (U+2212), el mismo que los montos", () => {
    expect(formatDays(-7)).toBe("−7 días");
    expect(formatDays(-1)).toBe("−1 día");
    // Gemelo positivo del negativo: el hyphen-minus del locale NO sobrevive.
    expect(formatDays(-7)).not.toBe("-7 días");
  });

  it("miles con separador", () => {
    expect(formatDays(1200)).toBe("1.200 días");
  });

  it("un no-finito NO se imprime como número", () => {
    expect(formatDays(Number.NaN)).toBe("s/d");
  });
});
