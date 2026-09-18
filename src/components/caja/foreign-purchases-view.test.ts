import { describe, expect, it } from "vitest";
import { foreignPurchaseDisplayTitle } from "./foreign-purchases-view";

describe("foreignPurchaseDisplayTitle", () => {
  it("muestra el proveedor que ya fue identificado en la cartola", () => {
    expect(foreignPurchaseDisplayTitle("Hubspot Inc.")).toBe("Hubspot Inc.");
  });

  it("mantiene el estado de identificación pendiente sólo sin proveedor", () => {
    expect(foreignPurchaseDisplayTitle("  ")).toBe("Compra por identificar");
  });
});
