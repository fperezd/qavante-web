import { describe, it, expect } from "vitest";
import { isSyncPending, isPartial } from "./sync-pending-state.logic";

/* #854 — "partial" con una fuente concreta NO es "sin credenciales". El dato COMPLETO
   (`available`) nunca dispara el vacío de "Ve a Credenciales", aunque venga con
   `missing_sources` residuales. Solo lo dispara cuando el dato NO está disponible. */

describe("isSyncPending", () => {
  it("available es dato completo → NUNCA sync-pendiente, aunque haya missing_sources", () => {
    expect(isSyncPending({ data_state: "available" })).toBe(false);
    expect(
      isSyncPending({ data_state: "available", missing_sources: ["Tipo de cambio USD"] }),
    ).toBe(false);
  });

  it("partial / estimated → sí es sync-pendiente (dato incompleto)", () => {
    expect(isSyncPending({ data_state: "partial" })).toBe(true);
    expect(isSyncPending({ data_state: "estimated" })).toBe(true);
  });

  it("sin data_state pero con missing_sources → sync-pendiente (contrato viejo)", () => {
    expect(isSyncPending({ missing_sources: ["Sincronización SII pendiente"] })).toBe(true);
  });

  it("sin data_state y sin missing_sources → no pendiente (vacío real)", () => {
    expect(isSyncPending({})).toBe(false);
    expect(isSyncPending({ missing_sources: [] })).toBe(false);
    expect(isSyncPending({ missing_sources: null })).toBe(false);
  });
});

describe("isPartial", () => {
  it("distingue dato incompleto de dato completo", () => {
    expect(isPartial({ data_state: "partial" })).toBe(true);
    expect(isPartial({ data_state: "estimated" })).toBe(true);
    expect(isPartial({ data_state: "available" })).toBe(false);
    expect(isPartial({})).toBe(false);
  });
});
