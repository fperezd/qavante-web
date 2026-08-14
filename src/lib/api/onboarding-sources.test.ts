import { describe, it, expect } from "vitest";
import {
  ONBOARDING_SOURCE_IDS,
  connectedSourcesFromStatus,
  deferredSourcesFromStatus,
  deriveSourceStates,
  unconnectedSources,
} from "./onboarding-sources";
import type { OnboardingStatus } from "./onboarding-status";

/* Adaptador de estado por fuente del onboarding. Puro → unit-testeable.
   Lo que se prueba es la promesa del patrón "conectar después": una fuente
   diferida NO se muestra como conectada, y una fuente sin dato NO se muestra
   como conocida. */

function status(sii: boolean, bank: boolean, completed = false): OnboardingStatus {
  return { completed, steps: { sii_connected: sii, bank_connected: bank } } as OnboardingStatus;
}

describe("onboarding-sources — adaptador de estado por fuente", () => {
  it("las fuentes conocidas son sii + bank (el ERP entra cuando exista contrato)", () => {
    expect([...ONBOARDING_SOURCE_IDS]).toEqual(["sii", "bank"]);
  });

  it("connectedSourcesFromStatus lee steps del backend", () => {
    expect(connectedSourcesFromStatus(status(true, false))).toEqual(["sii"]);
    expect(connectedSourcesFromStatus(status(false, true))).toEqual(["bank"]);
    expect(connectedSourcesFromStatus(status(true, true))).toEqual(["sii", "bank"]);
    expect(connectedSourcesFromStatus(status(false, false))).toEqual([]);
  });

  it("sin status (cargando o error) NINGUNA fuente se declara conectada", () => {
    expect(connectedSourcesFromStatus(undefined)).toEqual([]);
    const states = deriveSourceStates(undefined);
    expect(states.sii).toBe("pending");
    expect(states.bank).toBe("pending");
  });

  it("deferredSourcesFromStatus está vacío: el contrato aún no trae diferimiento", () => {
    // 🔌 Cuando CC-API publique el campo, este test cambia junto con la línea del
    // adaptador. Hasta entonces documenta la brecha, no la esconde.
    expect(deferredSourcesFromStatus(status(false, false))).toEqual([]);
  });

  it("deriveSourceStates: conectada > diferida > pendiente", () => {
    const states = deriveSourceStates(status(true, false), ["bank"]);
    expect(states.sii).toBe("connected");
    expect(states.bank).toBe("deferred");
  });

  it("una fuente conectada NUNCA se muestra como diferida, aunque se haya diferido antes", () => {
    const states = deriveSourceStates(status(true, true), ["sii", "bank"]);
    expect(states.sii).toBe("connected");
    expect(states.bank).toBe("connected");
  });

  it("sin diferir nada, lo no conectado queda pendiente", () => {
    const states = deriveSourceStates(status(false, true));
    expect(states.sii).toBe("pending");
    expect(states.bank).toBe("connected");
  });

  it("unconnectedSources lista diferidas y pendientes, en orden canónico", () => {
    expect(unconnectedSources(deriveSourceStates(status(false, false), ["sii"]))).toEqual([
      "sii",
      "bank",
    ]);
    expect(unconnectedSources(deriveSourceStates(status(true, true)))).toEqual([]);
  });
});
