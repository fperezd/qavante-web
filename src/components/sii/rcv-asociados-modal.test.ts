import { describe, expect, it } from "vitest";
import { notasSobreCreditoLabel } from "./rcv-asociados-modal";

describe("notasSobreCreditoLabel", () => {
  it("N=1 usa artículo y sustantivo singular", () => {
    expect(notasSobreCreditoLabel(1)).toBe("la 1 nota de crédito");
  });

  it("N≠1 conserva plural", () => {
    expect(notasSobreCreditoLabel(2)).toBe("las 2 notas de crédito");
  });
});
