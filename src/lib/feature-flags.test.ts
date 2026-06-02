/* Invariantes de ADR-0008 + ADR-0012. El default DEBE ser `false` (flag
   off ⇒ pantalla informativa, nunca mock). El override env APLICA en
   prod si la env var está explícitamente seteada (ADR-0012) — el gating
   sigue intencional porque Cloudflare requiere setear var + re-deploy. */

import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAGS,
  FLAG_GATING_ENDPOINT,
  type FeatureFlag,
  flagEnvVar,
  resolveFeatureFlag,
  resolveFeatureFlags,
} from "./feature-flags";

const devEnv = { NODE_ENV: "development" } as Record<string, string | undefined>;

describe("resolveFeatureFlag — jerarquía ADR-0008 + ADR-0012", () => {
  it("default seguro: los 15 flags son false sin config ni override", () => {
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

  it("override env APLICA en production cuando está seteado (ADR-0012 supersede ADR-0008)", () => {
    /* ADR-0012 supersede el invariante "nunca en prod" de ADR-0008. El
       override en prod sigue siendo intencional (requiere setear var en
       Cloudflare Workers + re-deploy), pero ya no está hard-bloqueado.
       Use case: desbloquear Sprint C1 + dominios del addendum mientras
       el backend no tenga listo `/api/management/config`. */
    expect(
      resolveFeatureFlag("managementAccounts", {
        env: { NODE_ENV: "production", NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS: "true" },
      }),
    ).toBe(true);
  });

  it("sin env var en production cae al default false (default seguro preservado)", () => {
    /* La protección "default OFF" sigue intacta: ausencia de env var en
       prod significa OFF. La activación requiere acción manual explícita. */
    expect(
      resolveFeatureFlag("managementAccounts", {
        env: { NODE_ENV: "production" },
      }),
    ).toBe(false);
  });

  it("override env 'false' en production fuerza OFF (kill-switch sobre config)", () => {
    /* Use case: desactivar rápido una feature en prod si tiene problemas,
       sin esperar al endpoint /api/management/config del backend. */
    expect(
      resolveFeatureFlag("managementAccounts", {
        env: { NODE_ENV: "production", NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS: "false" },
        config: { managementAccounts: true },
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
  it("devuelve los 15 flags, todos false por default", () => {
    const all = resolveFeatureFlags({ env: devEnv });
    expect(Object.keys(all).sort()).toEqual([...FEATURE_FLAGS].sort());
    expect(Object.values(all).every((v) => v === false)).toBe(true);
  });
});

describe("consistencia interna FEATURE_FLAGS ↔ FLAG_GATING_ENDPOINT", () => {
  /* Anti-regresión: si alguien agrega un flag al array pero olvida el
     endpoint correspondiente (o viceversa), estos tests fallan. También
     protege el runbook docs/operations/feature-flags-activation.md que
     documenta el mapping para Fernando. */

  it("cada flag de FEATURE_FLAGS tiene una entry en FLAG_GATING_ENDPOINT", () => {
    for (const flag of FEATURE_FLAGS) {
      expect(FLAG_GATING_ENDPOINT[flag]).toBeDefined();
      expect(typeof FLAG_GATING_ENDPOINT[flag]).toBe("string");
      expect(FLAG_GATING_ENDPOINT[flag].length).toBeGreaterThan(0);
    }
  });

  it("FLAG_GATING_ENDPOINT no tiene keys sobrantes (extras fuera de FEATURE_FLAGS)", () => {
    const flagSet = new Set<string>(FEATURE_FLAGS);
    for (const key of Object.keys(FLAG_GATING_ENDPOINT)) {
      expect(flagSet.has(key)).toBe(true);
    }
  });

  it("cada endpoint comienza con /api/ (path absoluto, sin host)", () => {
    for (const flag of FEATURE_FLAGS) {
      const endpoint = FLAG_GATING_ENDPOINT[flag];
      expect(endpoint.startsWith("/api/")).toBe(true);
    }
  });

  it("flagEnvVar produce strings con prefix NEXT_PUBLIC_FF_ y SCREAMING_SNAKE", () => {
    for (const flag of FEATURE_FLAGS) {
      const envVar = flagEnvVar(flag);
      expect(envVar.startsWith("NEXT_PUBLIC_FF_")).toBe(true);
      /* Sin minúsculas tras el prefix: SCREAMING_SNAKE estricto. */
      expect(envVar).toBe(envVar.toUpperCase());
      /* Solo letras, dígitos, underscores. */
      expect(envVar).toMatch(/^NEXT_PUBLIC_FF_[A-Z0-9_]+$/);
    }
  });

  it("FEATURE_FLAGS no tiene duplicados", () => {
    const set = new Set(FEATURE_FLAGS);
    expect(set.size).toBe(FEATURE_FLAGS.length);
  });

  it("flagEnvVar es 1-a-1 (no dos flags con la misma env var)", () => {
    const envVars = FEATURE_FLAGS.map(flagEnvVar);
    const set = new Set(envVars);
    expect(set.size).toBe(envVars.length);
  });

  it("FLAG_GATING_ENDPOINT también es 1-a-1 (no dos flags con el mismo endpoint)", () => {
    const endpoints = FEATURE_FLAGS.map((f) => FLAG_GATING_ENDPOINT[f]);
    const set = new Set(endpoints);
    expect(set.size).toBe(endpoints.length);
  });
});
