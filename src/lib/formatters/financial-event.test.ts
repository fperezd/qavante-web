import { describe, expect, it } from "vitest";
import { financialEventLabel } from "./financial-event";

describe("financialEventLabel", () => {
  it("traduce tipos financieros conocidos", () => {
    expect(financialEventLabel("supplier_payment")).toBe("Pago a proveedor");
    expect(financialEventLabel("client_collection")).toBe("Cobro de cliente");
  });

  it("conserva una etiqueta de negocio ya resuelta", () => {
    expect(financialEventLabel("Cobro de cliente")).toBe("Cobro de cliente");
  });

  it("no presenta un código desconocido", () => {
    expect(financialEventLabel("future_internal_event")).toBe("Tipo de movimiento no identificado");
  });
});
