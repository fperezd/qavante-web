import { describe, expect, it } from "vitest";
import type { OnboardingSyncRun } from "@/lib/api/onboarding-sync-runs";
import { claimSyncRunStart } from "./bienvenida-v15-live";
import {
  conteoLeido,
  estadoRunLegible,
  etapaRunLegible,
  etaLegible,
  fuentesRunV15,
  fuentesV15,
} from "./bienvenida-v15-model";
import { UNA_DIFERIDA } from "./bienvenida-v15-fixtures";

const run: OnboardingSyncRun = {
  run_id: "00000000-0000-0000-0000-000000000001",
  status: "running",
  updated_at: "2026-09-02T12:00:00Z",
  sources: [
    {
      source: "sii",
      status: "running",
      step: "reading",
      records_read: 12,
      eta_seconds: null,
      updated_at: "2026-09-02T12:00:00Z",
    },
    {
      source: "bank",
      status: "queued",
      step: null,
      records_read: null,
      eta_seconds: 120,
      updated_at: "2026-09-02T12:00:00Z",
    },
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
    expect(conteoLeido(1)).toBe("1 documento leído");
  });

  it("declara ETA no estimable cuando el backend entrega null", () => {
    expect(etaLegible(null)).toBe("Sin tiempo estimado disponible.");
    expect(etaLegible(0)).toBe("Finalización estimada ahora.");
    expect(etaLegible(120)).toBe("Aproximadamente 2 minutos estimados.");
  });

  it("no inventa tiempos para conectar una fuente", () => {
    const banco = fuentesV15(UNA_DIFERIDA).find((source) => source.id === "bank");
    expect(banco?.tiempoConexion).toBe("Sin tiempo estimado publicado por la fuente.");
  });

  it("traduce estados y etapas conocidas sin cambiar el hecho del backend", () => {
    expect(estadoRunLegible("running")).toBe("En curso");
    expect(etapaRunLegible("reading_documents")).toBe("Leyendo documentos");
    expect(etapaRunLegible("normalizing_documents")).toBe("Ordenando documentos");
    expect(etapaRunLegible("paso_nuevo")).toBe("Etapa en curso");
  });
});

describe("inicio de sync-run", () => {
  it("dos clicks rápidos reclaman un solo POST", () => {
    const inFlight = { current: false };
    expect(claimSyncRunStart(inFlight)).toBe(true);
    expect(claimSyncRunStart(inFlight)).toBe(false);
  });
});
