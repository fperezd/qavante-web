import { describe, it, expect } from "vitest";
import { toolLabel } from "./assistant-format";

describe("toolLabel", () => {
  it("mapea tools conocidas a etiqueta legible", () => {
    expect(toolLabel("pulso")).toBe("Pulso");
    expect(toolLabel("caja")).toBe("caja");
    expect(toolLabel("cobranza")).toBe("cobranza");
    expect(toolLabel("forecast")).toBe("caja proyectada");
  });
  it("es case-insensitive y trimea", () => {
    expect(toolLabel("  PULSO ")).toBe("Pulso");
  });
  it("desconocida → el nombre en minúscula (sin exponer estructura)", () => {
    expect(toolLabel("Xyz")).toBe("xyz");
  });
});
