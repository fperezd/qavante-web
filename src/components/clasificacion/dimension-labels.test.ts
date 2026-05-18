import { describe, expect, it } from "vitest";
import { dimensionTypeLabel, dimensionRequirementLabel } from "./dimension-labels";

describe("dimensionTypeLabel", () => {
  it("traduce los enums conocidos a lenguaje humano", () => {
    expect(dimensionTypeLabel("text")).toBe("Texto");
    expect(dimensionTypeLabel("currency")).toBe("Monto");
    expect(dimensionTypeLabel("reference")).toBe("Referencia");
  });

  it("fallback defensivo ante valor desconocido", () => {
    expect(dimensionTypeLabel("xyz")).toBe("Texto");
  });
});

describe("dimensionRequirementLabel", () => {
  it("mapea is_required a Obligatoria/Opcional", () => {
    expect(dimensionRequirementLabel(true)).toBe("Obligatoria");
    expect(dimensionRequirementLabel(false)).toBe("Opcional");
  });
});
