import { describe, it, expect } from "vitest";
import { tieneKeyActiva, type ApiKeyListResponse } from "./api-keys";

/* `tieneKeyActiva` deriva del listado si la empresa ya puede conectar un asistente (sin depender del
   endpoint sin-tipar /api/mcp/connection). */

function lista(items: Partial<ApiKeyListResponse["items"][number]>[]): ApiKeyListResponse {
  return {
    items: items.map((i, n) => ({
      id: i.id ?? `k${n}`,
      name: i.name ?? "Key",
      role_code: i.role_code ?? "viewer",
      key_prefix: i.key_prefix ?? "qav_live_xx",
      created_at: i.created_at ?? "2026-08-01T00:00:00Z",
      last_used_at: i.last_used_at ?? null,
      revoked_at: i.revoked_at ?? null,
    })),
  };
}

describe("tieneKeyActiva", () => {
  it("false sin datos o sin keys", () => {
    expect(tieneKeyActiva(undefined)).toBe(false);
    expect(tieneKeyActiva(lista([]))).toBe(false);
  });
  it("true si hay al menos una NO revocada", () => {
    expect(tieneKeyActiva(lista([{ revoked_at: null }]))).toBe(true);
    expect(tieneKeyActiva(lista([{ revoked_at: "2026-08-05T00:00:00Z" }, { revoked_at: null }]))).toBe(
      true,
    );
  });
  it("false si TODAS están revocadas", () => {
    expect(tieneKeyActiva(lista([{ revoked_at: "2026-08-05T00:00:00Z" }]))).toBe(false);
  });
});
