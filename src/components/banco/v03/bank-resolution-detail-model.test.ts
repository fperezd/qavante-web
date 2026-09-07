import { describe, expect, it } from "vitest";
import { movimientos } from "./banco-v03-fixtures";
import { resolutionDetailFromMovement } from "./bank-resolution-detail-model";

describe("resolutionDetailFromMovement", () => {
  it("adapta sólo evidencia publicada y no inventa asignaciones ni topología", () => {
    const detail = resolutionDetailFromMovement(movimientos()[0]!, "Cobro de cliente");
    expect(detail.reconciliation.status).toBe("conciliado");
    expect(detail.reconciliation.allocations).toEqual([]);
    expect(detail.reconciliation.topology).toBeUndefined();
    expect(detail.classification.status).toBe("clasificado");
    expect(detail.classification.canonicalType).toBe("Cobro de cliente");
    expect(detail.classification.allocations).toEqual([]);
  });

  it("mantiene conciliación y clasificación como estados independientes", () => {
    const detail = resolutionDetailFromMovement(movimientos()[1]!, "Impuestos");
    expect(detail.reconciliation.status).toBe("pendiente");
    expect(detail.classification.status).toBe("clasificado");
  });
});
