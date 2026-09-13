import { describe, expect, it } from "vitest";
import { actividadesRegistradas } from "./activity-registered-model";

const ITEMS = [
  {
    source: "reversible_action" as const,
    source_id: "undo-1",
    event_type: "bank_movement.auto_classify",
    summary: "Qavante clasificó movimientos.",
    created_at: "2026-09-02T12:00:00Z",
    outcome: null,
  },
  {
    source: "audit_event" as const,
    source_id: "audit-1",
    event_type: "collection.plan_created",
    summary: "Se registró un cambio auditado.",
    created_at: "2026-09-02T11:00:00Z",
    outcome: null,
  },
  {
    source: "sync_run" as const,
    source_id: "sync-1",
    event_type: "sii.sync",
    summary: "Se registró una sincronización.",
    created_at: "2026-09-02T10:00:00Z",
    outcome: "completed",
  },
];

describe("actividadesRegistradas", () => {
  it("presenta las tres fuentes con etiquetas de negocio", () => {
    expect(actividadesRegistradas({ items: ITEMS }, 5)).toEqual([
      expect.objectContaining({ fuente: "reversible_action", etiquetaFuente: "Acción automática" }),
      expect.objectContaining({ fuente: "audit_event", etiquetaFuente: "Cambio registrado" }),
      expect.objectContaining({
        fuente: "sync_run",
        etiquetaFuente: "Actualización de fuente",
        resultado: "Completada",
      }),
    ]);
  });

  it("no inventa hechos cuando el reader no entrega items", () => {
    expect(actividadesRegistradas(undefined, 5)).toEqual([]);
  });

  it("acota sin reordenar lo que registró el servidor", () => {
    expect(actividadesRegistradas({ items: ITEMS }, 1)).toHaveLength(1);
    expect(actividadesRegistradas({ items: ITEMS }, 1)[0]?.id).toBe("reversible_action:undo-1");
  });

  it("no presenta el resumen técnico publicado por la fuente", () => {
    const [activity] = actividadesRegistradas(
      {
        items: [
          {
            source: "audit_event",
            source_id: "audit-technical",
            event_type: "classification_rule.create",
            summary: "classification_rule.create · classification_rule",
            created_at: "2026-09-02T11:00:00Z",
            outcome: null,
          },
        ],
      },
      5,
    );

    expect(activity?.resumen).toBe("Regla de clasificación creada");
    expect(activity?.resumen).not.toContain("classification_rule");
  });
});
