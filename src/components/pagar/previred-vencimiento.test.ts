import { describe, it, expect } from "vitest";
import { vencimientoPrevired } from "./previred-vencimiento";

describe("vencimientoPrevired", () => {
  it("día 13 del mes siguiente", () => {
    expect(vencimientoPrevired("2026-07")).toBe("2026-08-13");
    expect(vencimientoPrevired("2026-01")).toBe("2026-02-13");
  });

  it("diciembre → 13 de enero del año siguiente", () => {
    expect(vencimientoPrevired("2026-12")).toBe("2027-01-13");
  });

  it("período inválido → null", () => {
    expect(vencimientoPrevired("2026")).toBeNull();
    expect(vencimientoPrevired("2026-13")).toBeNull();
    expect(vencimientoPrevired("")).toBeNull();
  });
});
