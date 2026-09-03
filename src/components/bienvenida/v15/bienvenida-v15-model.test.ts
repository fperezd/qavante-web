import { describe, expect, it } from "vitest";
import type { OnboardingSyncRun } from "@/lib/api/onboarding-sync-runs";
import { claimSyncRunStart } from "./bienvenida-v15-live";
import { conteoLeido, etaLegible, fuentesRunV15 } from "./bienvenida-v15-model";

const run: OnboardingSyncRun = {
  run_id: "00000000-0000-0000-0000-000000000001",
  status: "running",
  updated_at: "2026-09-02T12:00:00Z",
  sources: [
    { source: "sii", status: "running", step: "reading", records_read: 12, eta_seconds: null, updated_at: "2026-09-02T12:00:00Z" },
    { source: "bank", status: "queued", step: null, records_read: null, eta_seconds: 120, updated_at: "2026-09-02T12:00:00Z" },
  ],
};

describe("V15 sync-runs: datos honestos", () => {
  it("muestra el conteo sólo cuando el contrato lo publica", () => {
    expect(conteoLeido(12)).toBe("12 documentos leídos");
    expect(conteoLeido(null)).toBeNull();
    expect(fuentesRunV15(run).map((source) => source.conteo)).toEqual([
      "12 documentos leídos",
      null,
    ]);
  });

  it("preserva cero como conteo publicado, no como ausencia", () => {
    expect(conteoLeido(0)).toBe("0 documentos leídos");
  });

  it("declara ETA no estimable cuando el backend entrega null", () => {
    expect(etaLegible(null)).toBe("Sin tiempo estimado disponible.");
    expect(etaLegible(120)).toBe("Aproximadamente 2 minutos estimados.");
  });
});

describe("inicio de sync-run", () => {
  it("dos clicks rápidos reclaman un solo POST", () => {
    const inFlight = { current: false };
    expect(claimSyncRunStart(inFlight)).toBe(true);
    expect(claimSyncRunStart(inFlight)).toBe(false);
  });
});
