import { describe, expect, it } from "vitest";
import { aggregateSyncStatus, visibleSources, type SourceStatus } from "./sources-status";

const src = (over: Partial<SourceStatus>): SourceStatus => ({
  source: "sii",
  state: "ok",
  ...over,
});

describe("visibleSources (ocultar TGR)", () => {
  it("filtra la fuente 'tgr' (oculta por ahora)", () => {
    const out = visibleSources([
      src({ source: "sii" }),
      src({ source: "tgr" }),
      src({ source: "bice" }),
    ]);
    expect(out.map((s) => s.source)).toEqual(["sii", "bice"]);
  });

  it("TGR en error NO ensucia el agregado: con el resto ok, el nivel queda ok", () => {
    const sources = [
      src({ source: "sii", state: "ok" }),
      src({ source: "bice", state: "ok" }),
      src({ source: "tgr", state: "error" }), // session_expired: no cuenta
    ];
    expect(aggregateSyncStatus(visibleSources(sources)).level).toBe("ok");
    // sin filtrar, TGR lo pondría en "error" — así se ve que el filtro es el que limpia el header.
    expect(aggregateSyncStatus(sources).level).toBe("error");
  });
});

describe("aggregateSyncStatus", () => {
  it("todas ok → level ok, última sync = la más reciente", () => {
    const r = aggregateSyncStatus([
      src({ source: "sii", last_sync: "2026-06-25T10:00:00Z" }),
      src({ source: "bice", last_sync: "2026-06-25T12:30:00Z" }),
    ]);
    expect(r.level).toBe("ok");
    expect(r.lastSync).toBe("2026-06-25T12:30:00Z");
    expect(r.problemCount).toBe(0);
  });

  it("una stale → warning", () => {
    const r = aggregateSyncStatus([src({ state: "ok" }), src({ source: "tgr", state: "stale" })]);
    expect(r.level).toBe("warning");
    expect(r.problemCount).toBe(1);
  });

  it("error gana sobre stale", () => {
    const r = aggregateSyncStatus([
      src({ state: "stale" }),
      src({ source: "bice", state: "error" }),
    ]);
    expect(r.level).toBe("error");
    expect(r.problemCount).toBe(2);
  });

  it("lista vacía → ok sin última sync", () => {
    const r = aggregateSyncStatus([]);
    expect(r.level).toBe("ok");
    expect(r.lastSync).toBeNull();
    expect(r.problemCount).toBe(0);
  });

  it("'missing'/'unavailable SIN last_sync'/'syncing' NO pintan el header (Fase 2 / sin conectar / en curso)", () => {
    const r = aggregateSyncStatus([
      src({ state: "ok" }),
      src({ source: "sii_f22", state: "unavailable" }), // fantasma Fase 2: sin last_sync
      src({ source: "buk", state: "syncing" }),
      src({ source: "tgr", state: "missing" }),
      src({ source: "ine_advanced", state: "missing" }),
    ]);
    expect(r.level).toBe("ok");
    expect(r.problemCount).toBe(0);
  });

  it("'unavailable' que YA sincronizó (banco caído) → level caido (distinto de error)", () => {
    const r = aggregateSyncStatus([
      src({ source: "sii", last_sync: "2026-08-01T10:00:00Z" }),
      src({ source: "bice", state: "unavailable", last_sync: "2026-08-02T09:00:00Z" }),
    ]);
    expect(r.level).toBe("caido");
    expect(r.problemCount).toBe(1);
    expect(r.lastSync).toBe("2026-08-02T09:00:00Z");
  });

  it("severidad: error > caido > warning", () => {
    const caidoVsStale = aggregateSyncStatus([
      src({ source: "bice", state: "unavailable", last_sync: "2026-08-02T09:00:00Z" }),
      src({ source: "tgr", state: "stale" }),
    ]);
    expect(caidoVsStale.level).toBe("caido");

    const errorVsCaido = aggregateSyncStatus([
      src({ source: "bice", state: "unavailable", last_sync: "2026-08-02T09:00:00Z" }),
      src({ source: "sii", state: "error" }),
    ]);
    expect(errorVsCaido.level).toBe("error");
    expect(errorVsCaido.problemCount).toBe(2);
  });

  it("un error real gana aunque haya missing/unavailable-fantasma de ruido", () => {
    const r = aggregateSyncStatus([
      src({ source: "bice", state: "error" }),
      src({ source: "sii_f22", state: "unavailable" }), // sin last_sync → ruido
      src({ source: "tgr", state: "missing" }),
    ]);
    expect(r.level).toBe("error");
    expect(r.problemCount).toBe(1); // solo el error cuenta, no las de ruido
  });
});
