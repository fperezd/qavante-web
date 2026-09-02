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
        summary: "Clasificó 14 movimientos con una regla.",
        created_at: "2026-09-01T12:00:00Z",
        undo_expires_at: "2026-09-08T12:00:00Z",
        undo_available: true,
        status: "active",
      },
      {
        action_id: "anterior",
        action_type: "receivable.mark_ceded",
        summary: "Marcó una cesión automáticamente.",
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
        resumen: "Clasificó 14 movimientos con una regla.",
        creadaEn: "2026-09-01T12:00:00Z",
        venceEn: "2026-09-08T12:00:00Z",
        deshacerDisponible: true,
        deshacerResultado: null,
      },
      {
        actionId: "anterior",
        resumen: "Marcó una cesión automáticamente.",
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
});
