/* Invariantes de ADR-0008 + ADR-0012. El default DEBE ser `false` (flag
   off ⇒ pantalla informativa, nunca mock). El override env APLICA en
   prod si la env var está explícitamente seteada (ADR-0012) — el gating
   sigue intencional porque Cloudflare requiere setear var + re-deploy. */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAGS,
  FLAG_GATING_FIELD,
  FLAG_GATING_ENDPOINT,
  flagGatingIdentity,
  type FeatureFlag,
  flagEnvVar,
  resolveFeatureFlag,
  resolveFeatureFlags,
} from "./feature-flags";

const devEnv = { NODE_ENV: "development" } as Record<string, string | undefined>;

describe("resolveFeatureFlag — jerarquía ADR-0008 + ADR-0012", () => {
  it("default seguro: los 18 flags son false sin config ni override", () => {
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

  it("Decision Brief queda apagado por defecto y sólo se habilita con override explícito", () => {
    expect(resolveFeatureFlag("decisionBrief", { env: devEnv })).toBe(false);
    expect(
      resolveFeatureFlag("decisionBrief", {
        env: { ...devEnv, NEXT_PUBLIC_FF_DECISION_BRIEF: "true" },
      }),
    ).toBe(true);
  });
});

describe("flagEnvVar — mapeo camelCase → SCREAMING_SNAKE", () => {
  const cases: Array<[FeatureFlag, string]> = [
    ["managementAccounts", "NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS"],
    ["bankMovementClassification", "NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION"],
    ["bankBalances", "NEXT_PUBLIC_FF_BANK_BALANCES"],
    ["bandejaV07", "NEXT_PUBLIC_FF_BANDEJA_V07"],
    ["decisionBrief", "NEXT_PUBLIC_FF_DECISION_BRIEF"],
  ];
  it.each(cases)("%s → %s", (flag, expected) => {
    expect(flagEnvVar(flag)).toBe(expected);
  });
});

describe("resolveFeatureFlags", () => {
  it("devuelve los 18 flags, todos false por default", () => {
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

  it("la identidad endpoint+campo es 1-a-1; compartir endpoint exige campo explícito", () => {
    const identities = FEATURE_FLAGS.map(flagGatingIdentity);
    const set = new Set(identities);
    expect(set.size).toBe(identities.length);
    expect(FLAG_GATING_ENDPOINT.bancoV03).toBe("/api/sources/status");
    expect(FLAG_GATING_FIELD.bancoV03).toBe("sync_progress");
    expect(FLAG_GATING_ENDPOINT.impuestosV06).toBe("/api/sii/f29/impuesto");
    expect(FLAG_GATING_FIELD.impuestosV06).toBe("estimable");
    expect(flagGatingIdentity("bancoV03")).toBe("/api/sources/status#sync_progress");
    expect(flagGatingIdentity("bancoV03")).not.toBe("/api/sources/status#otro_campo");
    expect(flagGatingIdentity("impuestosV06")).toBe("/api/sii/f29/impuesto#estimable");
  });
});

describe("todo flag declarado tiene un consumidor vivo", () => {
  /* El modo de falla que este test cierra ya ocurrió: `cobrarV04` estuvo en "true" en
     `wrangler.toml` y en el `Dockerfile` mientras NINGÚN componente lo consultaba, así que ese
     "true" no encendía nada y las ~1.800 líneas de la pantalla quedaron inalcanzables. Un flag
     declarado y nunca leído no es una pantalla apagada: es código muerto con una etiqueta que
     dice lo contrario. Acá se mide la lectura REAL, recorriendo `src/` y buscando cada flag en un
     destructuring de `resolveFeatureFlags()` o en un `resolveFeatureFlag("…")`. Las stories y los
     tests no cuentan: un flag que sólo aparece ahí no gobierna ninguna ruta. */

  const SUFIJOS_NO_PRODUCTIVOS = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".stories.tsx"];

  function archivosDeProduccion(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "test") out.push(...archivosDeProduccion(full));
        continue;
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      if (SUFIJOS_NO_PRODUCTIVOS.some((sufijo) => entry.name.endsWith(sufijo))) continue;
      if (entry.name === "feature-flags.ts") continue;
      out.push(full);
    }
    return out;
  }

  /* Sin el flag `s`: `[^{}]` ya cruza saltos de línea por ser una clase de caracteres, y la
     alternativa `(?:[^{}]|
)*?` que lo imitaba retrocedía de forma catastrófica en los
     archivos grandes (la corrida se colgó con ella, no era una suite lenta). */
  const DESTRUCTURING = /\{([^{}]*?)\}\s*=\s*resolveFeatureFlags\(/g;
  const DIRECTO = /resolveFeatureFlag\(\s*"([A-Za-z0-9]+)"/g;

  const leidos = new Set<string>();
  for (const file of archivosDeProduccion(path.join(process.cwd(), "src"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(DESTRUCTURING)) {
      for (const nombre of match[1]!.match(/[A-Za-z0-9_]+/g) ?? []) leidos.add(nombre);
    }
    for (const match of source.matchAll(DIRECTO)) leidos.add(match[1]!);
  }

  it("el barrido encuentra consumidores reales (si no, se estaría midiendo a sí mismo)", () => {
    expect(leidos.size).toBeGreaterThan(20);
    expect(leidos.has("decisionBrief")).toBe(true);
    expect(leidos.has("cobrarDirectorioDeudores")).toBe(true);
  });

  it.each([...FEATURE_FLAGS])("%s lo consulta al menos una ruta o componente", (flag) => {
    expect(leidos.has(flag)).toBe(true);
  });
});
