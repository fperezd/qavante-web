import { describe, expect, it } from "vitest";
import { syncStatusText } from "./sync-status-text";

describe("syncStatusText", () => {
  it("distingue sincronizado de encolado (queued NO es 'listo')", () => {
    expect(syncStatusText("ok")).toBe("sincronizado");
    expect(syncStatusText("queued")).toContain("segundo plano");
    expect(syncStatusText("queued")).not.toContain("sincronizado");
  });

  it("cubre los estados vigentes en prod", () => {
    expect(syncStatusText("failed")).toBe("no se pudo conectar");
    expect(syncStatusText("skipped")).toContain("no conectado");
  });

  it("un estado nuevo del backend NO queda en blanco ni pasa por éxito", () => {
    // El mapa exhaustivo anterior renderizaba "Banco:" y nada.
    expect(syncStatusText("estado_futuro")).toBe("estado no confirmado");
    expect(syncStatusText(undefined)).toBe("sin confirmar");
    expect(syncStatusText(null)).toBe("sin confirmar");
  });
});
