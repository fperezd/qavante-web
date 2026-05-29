/* Feature flags — gating de pantallas del Addendum Frontend v2.0.
 *
 * Materializa el PATRÓN definido en ADR-0008 con la actualización de
 * ADR-0012 (override en prod permitido si la env var está explícitamente
 * seteada en Cloudflare Workers):
 *
 *   1. Override explícito: env `NEXT_PUBLIC_FF_<FLAG>` = "true"|"false".
 *      Aplica en TODOS los ambientes, incluido prod, si la env var está
 *      explícitamente seteada (ADR-0012). Sin env var → no aplica, cae
 *      al siguiente nivel. Defense: setear var en prod requiere acción
 *      manual en Cloudflare + re-deploy (Next.js inlinea NEXT_PUBLIC_*
 *      en build time) — no hay "accidente silencioso".
 *   2. Config inyectada: el resultado de `GET /api/management/config` cuando el
 *      backend lo exponga (hoy AUSENTE — verificado 2026-05-23, reconciliation
 *      P4-1). Se pasa por `opts.config`; lo cablea el PR de integración real.
 *   3. Default seguro: `false`. Flag false ⇒ la ruta existe pero renderiza un
 *      estado "todavía no disponible" — nunca UI mock, nunca ruta rota.
 *
 * El "fallback por presencia en el OpenAPI generado" del ADR-0008 NO se
 * implementa como introspección en runtime: `src/lib/api/types.ts` son tipos
 * (se borran al compilar) — no hay artefacto runtime que inspeccionar. Se
 * realizará cuando exista `/api/management/config` o cuando `generate:api`
 * emita además una lista de paths runtime. Hasta entonces el default `false`
 * es el comportamiento correcto y seguro. `FLAG_GATING_ENDPOINT` deja
 * documentado qué endpoint gobierna cada flag para ese trabajo futuro.
 */

export const FEATURE_FLAGS = [
  "managementAccounts",
  "managementDimensions",
  "industryTemplates",
  "multiCurrency",
  "classificationRules",
  "bankMovementClassification",
  "phase2PlanningPreview",
  "siiQueries",
  "cashFlowReport",
  "inicioMvp",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/* Endpoint del OpenAPI que justifica habilitar cada flag (ADR-0008 §2.2 +
 * addendum §13 Tabla 8). Hoy es documentación + dato para el fallback futuro;
 * NO habilita nada por sí mismo (el default sigue siendo `false`). */
export const FLAG_GATING_ENDPOINT: Record<FeatureFlag, string> = {
  managementAccounts: "/api/management/accounts/tree",
  managementDimensions: "/api/management/dimensions",
  industryTemplates: "/api/management/industry-templates",
  multiCurrency: "/api/core/currencies",
  classificationRules: "/api/treasury/classification-rules",
  bankMovementClassification: "/api/bank-movements/{movement_id}/classify",
  phase2PlanningPreview: "/api/management/financial-versions",
  siiQueries: "/api/sii/health",
  cashFlowReport: "/api/treasury/reports/cash-flow",
  inicioMvp: "/api/me",
};

/* Shape de `GET /api/management/config` (cuando el backend lo exponga).
 * Parcial: el backend puede mandar solo los flags que conoce; los ausentes
 * caen al default. `null` = endpoint no disponible todavía. */
export type FeatureFlagConfig = Partial<Record<FeatureFlag, boolean>> | null;

export interface ResolveFeatureFlagOptions {
  /** Resultado de `GET /api/management/config`. Inyectado por el PR de
   *  integración real; hoy siempre `null`/ausente (endpoint no existe). */
  config?: FeatureFlagConfig;
  /** Inyección de entorno para tests deterministas. Default: `process.env`. */
  env?: Record<string, string | undefined>;
}

/** `managementAccounts` → `NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS`. */
export function flagEnvVar(flag: FeatureFlag): string {
  const screaming = flag.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
  return `NEXT_PUBLIC_FF_${screaming}`;
}

function readOverride(
  flag: FeatureFlag,
  env: Record<string, string | undefined>,
): boolean | undefined {
  /* ADR-0012: el override aplica en TODOS los ambientes (incluido prod)
     si la env var está explícitamente seteada. Defense: setear var en
     prod requiere acción manual en Cloudflare Workers + re-deploy
     (Next.js inlinea NEXT_PUBLIC_* en build time) — no hay accidente
     silencioso. Sin env var → cae al siguiente nivel (config / default).
     Supersede el invariante de ADR-0008 ("nunca en prod"). */
  const raw = env[flagEnvVar(flag)];
  if (raw === undefined) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined; // valor no reconocido → se ignora, cae al siguiente nivel
}

/** Resuelve un flag según la jerarquía de ADR-0008. Default seguro: `false`. */
export function resolveFeatureFlag(
  flag: FeatureFlag,
  opts: ResolveFeatureFlagOptions = {},
): boolean {
  const env = opts.env ?? (process.env as Record<string, string | undefined>);

  const override = readOverride(flag, env);
  if (override !== undefined) return override;

  const fromConfig = opts.config?.[flag];
  if (fromConfig !== undefined) return fromConfig;

  return false;
}

/** Resuelve los 8 flags de una. Útil para Server Components / providers. */
export function resolveFeatureFlags(
  opts: ResolveFeatureFlagOptions = {},
): Record<FeatureFlag, boolean> {
  return Object.fromEntries(FEATURE_FLAGS.map((f) => [f, resolveFeatureFlag(f, opts)])) as Record<
    FeatureFlag,
    boolean
  >;
}
