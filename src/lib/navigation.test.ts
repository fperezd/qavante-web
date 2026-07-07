import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./navigation";

describe("navigation · safeInternalPath", () => {
  it("acepta rutas internas tal cual", () => {
    expect(safeInternalPath("/inicio")).toBe("/inicio");
    expect(safeInternalPath("/pagar/impuestos/f29")).toBe("/pagar/impuestos/f29");
    expect(safeInternalPath("/caja?tab=1")).toBe("/caja?tab=1");
  });
  it("rechaza URLs absolutas → /inicio", () => {
    expect(safeInternalPath("https://evil-phish.com")).toBe("/inicio");
    expect(safeInternalPath("http://evil.com/x")).toBe("/inicio");
  });
  it("rechaza protocol-relative y el truco del backslash → /inicio", () => {
    expect(safeInternalPath("//evil-phish.com")).toBe("/inicio");
    expect(safeInternalPath("/\\evil.com")).toBe("/inicio");
  });
  it("null/vacío/no-ruta → /inicio", () => {
    expect(safeInternalPath(null)).toBe("/inicio");
    expect(safeInternalPath(undefined)).toBe("/inicio");
    expect(safeInternalPath("")).toBe("/inicio");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/inicio");
  });
});
