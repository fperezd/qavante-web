import { describe, expect, it } from "vitest";
import { movimientos } from "./banco-v03-fixtures";
import type { MovementResolutionDetailResponse } from "@/lib/api/treasury";
import {
  resolutionDetailFromApi,
  resolutionDetailFromMovement,
} from "./bank-resolution-detail-model";

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

describe("resolutionDetailFromApi", () => {
  it("publica ambos estados, el origen y la distribución sin recalcular el match", () => {
    const apiDetail = {
      movement: {
        id: "m1",
        bank_account_id: "a1",
        external_id: "ext",
        date: "2026-09-07",
        description: "Pago",
        amount: "100000",
        direction: "debit",
        currency_code: "CLP",
        bank_account: { bank_name: "BICE", account_name: "CC" },
      },
      reconciliation: {
        stored_status: "unmatched",
        effective_status: "matched",
        current_case: {
          id: "case-1",
          status: "confirmed",
          decision: "match",
          topology: "N:N",
          financial_event_type: "supplier_payment",
          canonical_category: "supplier_payment",
          settlement_rail: "bank_transfer",
          score: "1",
          engine_version: "v2",
          explanation: "documentos exactos",
          metadata: {},
          created_at: "2026-09-07T12:00:00Z",
          allocations: [
            {
              node_kind: "bank_movement",
              node_id: "m2",
              role: "source",
              signed_amount: "40000",
              currency_code: "CLP",
              source_label: "Segundo movimiento",
            },
            {
              node_kind: "payable",
              node_id: "p1",
              role: "settled",
              signed_amount: "-100000",
              currency_code: "CLP",
              source_label: "Factura 10",
              source_path: "/pagar/facturas-recibidas",
            },
          ],
          components: [],
          evidence: [{ code: "rut_exact", result: "pass", weight: "1" }],
        },
        legacy_documents: [],
        history: [],
      },
      classification: {
        id: "c1",
        status: "classified",
        input_mode: "percentage",
        canonical_category: "supplier_payment",
        financial_event_type: "supplier_payment",
        confidence: "1",
        source: "manual",
        allocations: [
          {
            id: "al1",
            management_account_id: "ma1",
            management_account_name: "Administración",
            amount: "60000",
            currency_code: "CLP",
            percentage: "60",
            dimensions: [{ dimension_name: "Sucursal", value_name: "Santiago" }],
            source: "manual",
          },
          {
            id: "al2",
            management_account_id: "ma2",
            management_account_name: "Operaciones",
            amount: "40000",
            currency_code: "CLP",
            percentage: "40",
            dimensions: [],
            source: "manual",
          },
        ],
        history: [],
      },
    } as MovementResolutionDetailResponse;

    const detail = resolutionDetailFromApi(apiDetail);
    expect(detail.reconciliation.status).toBe("conciliado");
    expect(detail.reconciliation.canUnreconcile).toBe(false);
    expect(detail.reconciliation.topology).toBe("N:N");
    expect(detail.reconciliation.allocations[0]?.kind).toBe("bank_movement");
    expect(detail.reconciliation.allocations[0]?.label).toBe("Segundo movimiento");
    expect(detail.reconciliation.allocations[1]?.origin?.href).toBe("/pagar/facturas-recibidas");
    expect(detail.classification.allocations).toHaveLength(2);
    expect(detail.classification.allocations[0]?.dimensions).toEqual([
      { name: "Sucursal", value: "Santiago" },
    ]);
  });
});
