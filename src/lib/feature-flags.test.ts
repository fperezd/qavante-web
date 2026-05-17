/* Invariantes de ADR-0008. El default DEBE ser `false` (flag off ⇒ pantalla
   informativa, nunca mock). El override env nunca aplica en prod. Un cambio
   accidental acá liberaría pantallas del addendum sin backend. */

import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAGS,
  type FeatureFlag,
  flagEnvVar,
  resolveFeatureFlag,
  resolveFeatureFlags,
} from "./feature-flags";

const devEnv = { NODE_ENV: "development" } as Record<string, string | undefined>;

describe("resolveFeatureFlag — jerarquía ADR-0008", () => {
  it("default seguro: los 7 flags son false sin config ni override", () => {
    for (const flag of FEATURE_FLAGS) {
      expect(resolveFeatureFlag(flag, { env: devEnv })).toBe(false);
    }
  });

  it("config inyectada (futuro /api/management/config) habilita un flag", () => {
    expect(
      resolveFeatureFlag("managementAccounts", {
        env: devEnv,
        config: { managementAccounts: true },
      }),
    ).toBe(true);
  });

  it("config con flag ausente cae al default false", () => {
    expect(
      resolveFeatureFlag("multiCurrency", { env: devEnv, config: { managementAccounts: true } }),
    ).toBe(false);
  });

  it("config puede forzar false explícito", () => {
    expect(
      resolveFeatureFlag("managementAccounts", {
        env: devEnv,
        config: { managementAccounts: false },
      }),
    ).toBe(false);
  });

  it("override env 'true' habilita en dev", () => {
    expect(
      resolveFeatureFlag("managementDimensions", {
        env: { ...devEnv, NEXT_PUBLIC_FF_MANAGEMENT_DIMENSIONS: "true" },
      }),
    ).toBe(true);
  });

  it("override env gana sobre la config", () => {
    expect(
      resolveFeatureFlag("managementAccounts", {
        env: { ...devEnv, NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS: "false" },
        config: { managementAccounts: true },
      }),
    ).toBe(false);
  });

  it("override env se IGNORA en production (invariante ADR-0008)", () => {
    expect(
      resolveFeatureFlag("managementAccounts", {
        env: { NODE_ENV: "production", NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS: "true" },
      }),
    ).toBe(false);
  });

  it("valor de override no reconocido se ignora (cae a default)", () => {
    expect(
      resolveFeatureFlag("classificationRules", {
        env: { ...devEnv, NEXT_PUBLIC_FF_CLASSIFICATION_RULES: "sí" },
      }),
    ).toBe(false);
  });
});

describe("flagEnvVar — mapeo camelCase → SCREAMING_SNAKE", () => {
  const cases: Array<[FeatureFlag, string]> = [
    ["managementAccounts", "NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS"],
    ["bankMovementClassification", "NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION"],
    ["phase2PlanningPreview", "NEXT_PUBLIC_FF_PHASE2_PLANNING_PREVIEW"],
  ];
  it.each(cases)("%s → %s", (flag, expected) => {
    expect(flagEnvVar(flag)).toBe(expected);
  });
});

describe("resolveFeatureFlags", () => {
  it("devuelve los 7 flags, todos false por default", () => {
    const all = resolveFeatureFlags({ env: devEnv });
    expect(Object.keys(all).sort()).toEqual([...FEATURE_FLAGS].sort());
    expect(Object.values(all).every((v) => v === false)).toBe(true);
  });
});
