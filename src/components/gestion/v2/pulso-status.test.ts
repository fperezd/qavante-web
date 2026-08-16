import { describe, expect, it } from "vitest";
import { resolvePulsoPresentation } from "./pulso-status";

describe("resolvePulsoPresentation", () => {
  it("preserva las etiquetas y tonos de los estados conocidos", () => {
    expect(resolvePulsoPresentation("strong")).toEqual({
      estado: "Pulso fuerte",
      tono: "ok",
      known: true,
    });
  });

  it("degrada honestamente un estado que aún no conoce el frontend", () => {
    expect(resolvePulsoPresentation("queued")).toEqual({
      estado: "Estado del Pulso pendiente de actualizar",
      tono: "warn",
      known: false,
    });
  });
});
