import { describe, expect, it } from "vitest";
import { actividadesRegistradas } from "./activity-registered-model";

const ITEMS = [
  { source: "reversible_action" as const, source_id: "undo-1", event_type: "bank_movement.auto_classify", summary: "Qavante clasificó movimientos.", created_at: "2026-09-02T12:00:00Z", outcome: null },
  { source: "audit_event" as const, source_id: "audit-1", event_type: "collection.plan_created", summary: "Se registró un cambio auditado.", created_at: "2026-09-02T11:00:00Z", outcome: null },
  { source: "sync_run" as const, source_id: "sync-1", event_type: "sii.sync", summary: "Se registró una sincronización.", created_at: "2026-09-02T10:00:00Z", outcome: "completed" },
];

describe("actividadesRegistradas", () => {
  it("preserva las tres fuentes y sus badges explícitos", () => {
    expect(actividadesRegistradas({ items: ITEMS }, 5)).toEqual([
      expect.objectContaining({ fuente: "reversible_action", etiquetaFuente: "Automatismo reversible" }),
      expect.objectContaining({ fuente: "audit_event", etiquetaFuente: "Evento auditado" }),
      expect.objectContaining({ fuente: "sync_run", etiquetaFuente: "Sincronización registrada", resultado: "completed" }),
    ]);
  });

  it("no inventa hechos cuando el reader no entrega items", () => {
    expect(actividadesRegistradas(undefined, 5)).toEqual([]);
  });

  it("acota sin reordenar lo que registró el servidor", () => {
    expect(actividadesRegistradas({ items: ITEMS }, 1)).toHaveLength(1);
    expect(actividadesRegistradas({ items: ITEMS }, 1)[0]?.id).toBe("reversible_action:undo-1");
  });
});
