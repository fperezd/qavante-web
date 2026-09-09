import { describe, expect, it } from "vitest";
import { normalizeVisibleText } from "./visible-text";

const EM_DASH = /\u2014/;

describe("normalizeVisibleText", () => {
  it("reemplaza U+2014 de un label dinámico por el separador visible aprobado", () => {
    const rawInput = "BANCO BICE — Factura 3218763 · Obligación crítica";
    expect(rawInput).toMatch(EM_DASH);

    const rendered = normalizeVisibleText(rawInput);

    expect(rendered).toBe("BANCO BICE · Factura 3218763 · Obligación crítica");
    expect(rendered).not.toMatch(EM_DASH);
  });

  it("conserva el gemelo positivo que ya usa punto medio", () => {
    const rendered = normalizeVisibleText("BANCO BICE · Factura 3218763 · Obligación crítica");

    expect(rendered).toBe("BANCO BICE · Factura 3218763 · Obligación crítica");
    expect(rendered).not.toMatch(EM_DASH);
  });

  it("conserva estados nulos sin convertirlos en texto", () => {
    expect(normalizeVisibleText(null)).toBeNull();
    expect(normalizeVisibleText(undefined)).toBeUndefined();
  });
});
