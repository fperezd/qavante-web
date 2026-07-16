import { describe, expect, it } from "vitest";
import type { SourceStatus } from "@/lib/api/sources-status";
import { ultimoSync } from "./source-last-sync-model";

const src = (over: Partial<SourceStatus> = {}): SourceStatus =>
  ({ source: "sii_rcv", state: "ok", last_sync: "2026-07-16T12:00:00Z", ...over }) as SourceStatus;

const base = { cargando: false, error: false, sourceCode: "sii_rcv" };

describe("ultimoSync", () => {
  it("cargando: no afirma", () => {
    expect(ultimoSync({ ...base, cargando: true, sources: [src()] })).toEqual({ mostrar: false });
  });

  // El bug vivo en prod: el endpoint es api-key-only → 401 → decía "Sin sincronizar todavía".
  it("con error NO dice 'sin sincronizar' — no pudimos preguntar", () => {
    expect(ultimoSync({ ...base, error: true, sources: undefined })).toEqual({ mostrar: false });
  });

  it("sin data (401) no afirma", () => {
    expect(ultimoSync({ ...base, sources: undefined })).toEqual({ mostrar: false });
  });

  it("la fuente no vino en la respuesta: no afirma (ojo bice vs bank_bice)", () => {
    expect(ultimoSync({ ...base, sourceCode: "bice", sources: [src()] })).toEqual({
      mostrar: false,
    });
  });

  it("fuente conocida con last_sync: lo muestra", () => {
    expect(ultimoSync({ ...base, sources: [src()] })).toEqual({
      mostrar: true,
      last: "2026-07-16T12:00:00Z",
    });
  });

  it("fuente conocida sin last_sync: ahí SÍ es 'sin sincronizar' de verdad", () => {
    expect(ultimoSync({ ...base, sources: [src({ last_sync: null })] })).toEqual({
      mostrar: true,
      last: null,
    });
  });
});
