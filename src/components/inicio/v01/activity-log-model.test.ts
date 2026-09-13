import { describe, expect, it } from "vitest";
import type { ReversibleActionsListResponse } from "@/lib/api/reversible-actions";
import { actividadesAutomaticas } from "./activity-log-model";

function respuesta(): ReversibleActionsListResponse {
  return {
    total: 2,
    items: [
      {
        action_id: "nueva",
        action_type: "bank_movement.auto_classify",
        summary: "Clasificamos un movimiento con la regla 'Software recurrente'",
        created_at: "2026-09-01T12:00:00Z",
        undo_expires_at: "2026-09-08T12:00:00Z",
        undo_available: true,
        status: "active",
      },
      {
        action_id: "anterior",
        action_type: "receivable.mark_ceded",
        summary:
          "Marcamos una factura como cedida a 76.123.456-7 con fecha 2026-08-31 (la cobra el factor, no la empresa)",
        created_at: "2026-08-31T12:00:00Z",
        undo_expires_at: "2026-09-07T12:00:00Z",
        undo_available: false,
        undo_result: "undo_not_supported",
        status: "active",
      },
    ],
  };
}

describe("actividadesAutomaticas", () => {
  it("conserva el orden más-reciente-primero del contrato y el estado real de Deshacer", () => {
    expect(actividadesAutomaticas(respuesta(), 5)).toEqual([
      {
        actionId: "nueva",
        resumen: "Qavante clasificó un movimiento con la regla “Software recurrente”.",
        creadaEn: "2026-09-01T12:00:00Z",
        venceEn: "2026-09-08T12:00:00Z",
        deshacerDisponible: true,
        deshacerResultado: null,
      },
      {
        actionId: "anterior",
        resumen: "Se registró una factura cedida a 76.123.456-7 el 31-08-2026.",
        creadaEn: "2026-08-31T12:00:00Z",
        venceEn: "2026-09-07T12:00:00Z",
        deshacerDisponible: false,
        deshacerResultado: "undo_not_supported",
      },
    ]);
  });

  it("acota la portada a cinco sin fabricar una sexta entrada", () => {
    expect(actividadesAutomaticas(respuesta(), 1)).toHaveLength(1);
    expect(actividadesAutomaticas(null, 5)).toEqual([]);
  });

  it("identifica cada postergación por proveedor y conserva ambas fechas sin presentarlas como vigentes", () => {
    const data = respuesta();
    data.items = [
      {
        ...data.items[0]!,
        action_id: "proveedor-uno",
        action_type: "payable.postpone",
        summary:
          "Postergamos 15 días el pago a Proveedor Uno: vencía el 2026-03-10 y ahora vence el 2026-03-25",
      },
      {
        ...data.items[0]!,
        action_id: "proveedor-dos",
        action_type: "payable.postpone",
        summary:
          "Postergamos 30 días el pago a Proveedor Dos: vencía el 2026-04-01 y ahora vence el 2026-05-01",
      },
    ];

    const activities = actividadesAutomaticas(data, 2);
    expect(activities.map((activity) => activity.resumen)).toEqual([
      "Se postergó 15 días el pago a Proveedor Uno: del 10-03-2026 al 25-03-2026.",
      "Se postergó 30 días el pago a Proveedor Dos: del 01-04-2026 al 01-05-2026.",
    ]);
    expect(activities[0]?.resumen).not.toContain("ahora vence");
  });

  it("no expone un resumen libre que no coincida exactamente con el contrato", () => {
    const data = respuesta();
    data.items[0] = {
      ...data.items[0]!,
      action_type: "payable.postpone",
      summary: "scope=tenant-7; POST /api/payables/secret",
    };

    expect(actividadesAutomaticas(data, 1)[0]?.resumen).toBe(
      "Se registró una postergación de pago.",
    );
  });

  it("conserva una razón social larga y ambas fechas al identificar qué se deshará", () => {
    const supplier = `Sociedad de Servicios ${"Empresariales y Tecnológicos ".repeat(4)}SpA`;
    expect(supplier.length).toBeGreaterThan(120);
    const data = respuesta();
    data.items[0] = {
      ...data.items[0]!,
      action_type: "payable.postpone",
      summary: `Postergamos 7 días el pago a ${supplier}: vencía el 2026-06-01 y ahora vence el 2026-06-08`,
    };

    const summary = actividadesAutomaticas(data, 1)[0]?.resumen;
    expect(summary).toContain(supplier);
    expect(summary).toContain("del 01-06-2026 al 08-06-2026");
  });
});
