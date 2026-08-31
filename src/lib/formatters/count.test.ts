import { describe, expect, it } from "vitest";
import { concordar, formatCount, formatDays } from "./count";

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

describe("concordar — centralizado desde issue #94 (antes duplicado en 6 archivos)", () => {
  it("n=1 toma la forma singular", () => {
    expect(concordar(1, "documento", "documentos")).toBe("documento");
  });

  /* [control positivo] gemelo del anterior con la MISMA pareja: n≠1 NUNCA devuelve el
   * singular. Sin este gemelo, un mutante que fuerce siempre singular sobreviviría — el mismo
   * agujero de cobertura que reapareció cuatro veces en V08. */
  it("n=2 toma la forma plural (no el singular de arriba)", () => {
    expect(concordar(2, "documento", "documentos")).toBe("documentos");
  });

  it("n=0 toma la forma PLURAL — «0 documentos» es correcto en español, 0 no es un caso especial", () => {
    expect(concordar(0, "documento", "documentos")).toBe("documentos");
  });

  it("negativo también es plural (sólo n===1 es singular)", () => {
    expect(concordar(-1, "documento", "documentos")).toBe("documentos");
  });

  it("es genérico: sirve para frases completas, no sólo sustantivos sueltos (uso real de V08)", () => {
    expect(concordar(1, "El documento listado suma", "Los 3 documentos listados suman")).toBe(
      "El documento listado suma",
    );
  });
});
