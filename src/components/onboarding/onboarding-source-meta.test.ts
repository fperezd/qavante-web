import { describe, it, expect } from "vitest";
import { ONBOARDING_SOURCE_IDS } from "@/lib/api/onboarding-sources";
import {
  ONBOARDING_SOURCE_META,
  SOURCE_STATE_BADGE,
  SOURCE_STATE_LABEL,
  sourceActionLabel,
  sourceStateDescription,
} from "./onboarding-source-meta";

describe("onboarding-source-meta — cómo se le habla al usuario de cada fuente", () => {
  it("cubre todas las fuentes conocidas", () => {
    for (const id of ONBOARDING_SOURCE_IDS) {
      expect(ONBOARDING_SOURCE_META[id].label.length).toBeGreaterThan(0);
      expect(ONBOARDING_SOURCE_META[id].benefit.length).toBeGreaterThan(0);
      expect(ONBOARDING_SOURCE_META[id].missingConsequence.length).toBeGreaterThan(0);
    }
  });

  it("una fuente diferida NO se anuncia como conectada", () => {
    expect(SOURCE_STATE_LABEL.deferred).not.toMatch(/conectada$/i);
    expect(SOURCE_STATE_LABEL.connected).toBe("Conectada");
    expect(SOURCE_STATE_LABEL.pending).toBe("Sin conectar");
  });

  it("badges: conectada = éxito; diferida = informativa (no es un error); pendiente = aviso", () => {
    expect(SOURCE_STATE_BADGE.connected).toBe("success");
    expect(SOURCE_STATE_BADGE.deferred).toBe("info");
    expect(SOURCE_STATE_BADGE.pending).toBe("warning");
  });

  it("el detalle de una fuente NO conectada dice qué falta, no lo esconde", () => {
    for (const id of ONBOARDING_SOURCE_IDS) {
      const meta = ONBOARDING_SOURCE_META[id];
      expect(sourceStateDescription(id, "pending")).toContain(meta.missingConsequence);
      expect(sourceStateDescription(id, "deferred")).toContain(meta.missingConsequence);
      expect(sourceStateDescription(id, "connected")).toBe(meta.benefit);
    }
  });

  it("la acción invita a conectar cuando no está conectada", () => {
    expect(sourceActionLabel("pending")).toBe("Conectar ahora");
    expect(sourceActionLabel("deferred")).toBe("Conectar ahora");
    expect(sourceActionLabel("connected")).toBe("Revisar conexión");
  });
});
