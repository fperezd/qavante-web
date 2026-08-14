import { describe, expect, it } from "vitest";
import type { SourceStatus } from "@/lib/api/sources-status";
import type { OnboardingSourceStates } from "@/lib/api/onboarding-sources";
import { pendingConnectionsBanner, type PendingBannerInput } from "./pending-connections-model";

/* El banner le habla a TODOS los tenants existentes (el backfill los dejó con
   `completed = true`), así que cada falso positivo es una mentira a un cliente
   vivo. Estos tests fijan la regla: solo `missing` del estado canónico. */

const CONECTADAS: OnboardingSourceStates = { sii: "connected", bank: "connected" };
const BANCO_SIN_CONECTAR: OnboardingSourceStates = { sii: "connected", bank: "pending" };

const src = (source: string, state: SourceStatus["state"]): SourceStatus => ({ source, state });

function input(over: Partial<PendingBannerInput> = {}): PendingBannerInput {
  return {
    states: BANCO_SIN_CONECTAR,
    isUnknown: false,
    completed: true,
    sources: [src("sii_rcv", "ok"), src("bank_bice", "missing")],
    sourcesUnknown: false,
    dismissed: false,
    ...over,
  };
}

describe("pendingConnectionsBanner", () => {
  it("muestra la fuente que el estado canónico reporta como missing", () => {
    expect(pendingConnectionsBanner(input())).toEqual({ mostrar: true, sources: ["bank"] });
  });

  it("NO dice 'te falta conectar' por un sync degradado (stale)", () => {
    const d = pendingConnectionsBanner(input({ sources: [src("bank_bice", "stale")] }));
    expect(d).toEqual({ mostrar: false });
  });

  it("NO dice 'te falta conectar' por una fuente conectada con error", () => {
    const d = pendingConnectionsBanner(input({ sources: [src("bank_bice", "error")] }));
    expect(d).toEqual({ mostrar: false });
  });

  it("NO afirma nada si la fuente no viene en la respuesta canónica", () => {
    const d = pendingConnectionsBanner(input({ sources: [src("sii_rcv", "ok")] }));
    expect(d).toEqual({ mostrar: false });
  });

  it("NO afirma nada si no pudimos leer el estado canónico", () => {
    expect(pendingConnectionsBanner(input({ sourcesUnknown: true }))).toEqual({ mostrar: false });
    expect(pendingConnectionsBanner(input({ sources: undefined }))).toEqual({ mostrar: false });
  });

  it("no se muestra sin onboarding completado ni sin dato del onboarding", () => {
    expect(pendingConnectionsBanner(input({ completed: false }))).toEqual({ mostrar: false });
    expect(pendingConnectionsBanner(input({ isUnknown: true }))).toEqual({ mostrar: false });
  });

  it("no se muestra si el usuario lo cerró", () => {
    expect(pendingConnectionsBanner(input({ dismissed: true }))).toEqual({ mostrar: false });
  });

  it("con todo conectado no se muestra", () => {
    const d = pendingConnectionsBanner(
      input({ states: CONECTADAS, sources: [src("bank_bice", "missing")] }),
    );
    expect(d).toEqual({ mostrar: false });
  });

  it("lista las dos fuentes cuando ambas están missing", () => {
    const d = pendingConnectionsBanner(
      input({
        states: { sii: "pending", bank: "deferred" },
        sources: [src("sii_rcv", "missing"), src("bank_bice", "missing")],
      }),
    );
    expect(d).toEqual({ mostrar: true, sources: ["sii", "bank"] });
  });
});
