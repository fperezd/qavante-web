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
  "miCuenta",
  "operationalResult",
  "accountsReceivable",
  "accountsPayable",
  "dashboardSummary",
  "inicioEjecutivoV2",
  "pulsoDetail",
  "assistant",
  "onboarding",
  "obligations",
  "syncStatus",
  "remuneraciones",
  "bankBalances",
  "saludScreen",
  "libroVentasV2",
  "libroComprasV2",
  "cajaV2",
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
  /* Mi cuenta también lee /api/me, pero su capacidad propia (y única
     respecto de inicio) es cerrar sesión — ese es el endpoint que justifica
     habilitar el flag y lo mantiene 1-a-1 en el mapping. */
  miCuenta: "/api/auth/logout",
  /* Resultado Operacional de Gestión (Sprint C5). Endpoint FE-first esperado
     del backend (aún no existe — ver brecha gestion-operational-result). */
  operationalResult: "/api/management/operational-result",
  /* Cobrar — cuentas por cobrar (Sprint C4). Endpoint FE-first esperado (aún
     no existe — ver brecha cobrar-accounts-receivable). */
  accountsReceivable: "/api/treasury/accounts-receivable",
  /* Pagar — cuentas por pagar (Sprint C4). Endpoint FE-first esperado (aún no
     existe — ver brecha pagar-accounts-payable). */
  accountsPayable: "/api/treasury/accounts-payable",
  /* Inicio Ejecutivo (Sprint C8) — el dashboard agregado. Endpoint FE-first
     esperado (aún no existe — ver brecha inicio-dashboard-summary). */
  dashboardSummary: "/api/dashboard/summary",
  /* Inicio Ejecutivo v2 (rediseño aprobado 2026-07-12) — consume la misma fuente
     base (`/api/dashboard/summary`) que dashboardSummary, pero lo que lo DISTINGUE
     y lo enciende del todo es la Fase 2: `collection-forecast` (cobranza realizable
     + plan de brecha). Ese es su endpoint de gating (FE-first, aún no existe). Con
     el flag ON tiene prioridad sobre dashboardSummary; hoy OFF, degradación honesta. */
  inicioEjecutivoV2: "/api/treasury/collection-forecast",
  /* Pulso detalle (Sprint C6/C7) — "¿por qué está así mi Pulso?". Endpoint
     FE-first esperado (aún no existe — ver pulso-detail-contract). */
  pulsoDetail: "/api/management/pulso",
  /* Asistente Qavante (Sprint C9, Anexo G) — chat read-only. Endpoint FE-first
     esperado (aún no existe — wire format en ADR-0004). */
  assistant: "/api/assistant/chat",
  /* Onboarding wizard (signup → verificar → SII → banco → rubro → saldo apertura
     → traer datos → dashboard). Modelo ADR-0017 (1ra persona crea empresa owner).
     Todos los endpoints vivos en prod (qavante-api #344/#345/#346 + signup/verify). */
  onboarding: "/api/auth/signup",
  /* Obligaciones / Préstamos (Tesorería → Pagar). Alta de préstamo con
     amortización francesa + conciliación de cuotas vs débitos bancarios.
     Endpoints vivos en prod y aceptan cookie (verificado 2026-06-25). */
  obligations: "/api/treasury/obligations",
  /* Indicador de sincronización (header): estado por fuente + última
     actualización + errores. FE-first contra `/api/sources/status` — el endpoint
     existe pero es api-key-only (no acepta cookie); activar cuando CC-API lo
     migre a require_session. Ver STATE_OF_THE_TRAIN (gaps de auth). */
  syncStatus: "/api/sources/status",
  /* Remuneraciones (RRHH / planilla) — dotación + totales de planilla desde BUK.
     FE-first contra `/api/buk/employees` (existe en el OpenAPI). CC-API está
     construyendo Remuneraciones en paralelo; activar cuando el conector BUK
     acepte cookie de sesión (hoy podría ser api-key-only → 401). Ver
     STATE_OF_THE_TRAIN. */
  remuneraciones: "/api/buk/employees",
  /* Saldos de las cuentas de banco (Caja). FE-first contra `/api/bice/saldo`
     (SaldoResponse: saldo contable + disponible por cuenta, CLP/USD). El
     endpoint existe pero es api-key-only (401 "Falta X-Api-Key" con cookie);
     activar cuando CC-API lo migre a require_session. Ver STATE_OF_THE_TRAIN. */
  bankBalances: "/api/bice/saldo",
  /* Pantalla Salud (PULSO + Health Score, ADR-0064). FE-first: la vista
     (`SaludView`) ya existe (prototipo, PR #476); la ruta queda gated OFF hasta
     que CC-API exponga el motor v2 (qavante-api #492 PULSO / #495 QHS / #493
     flip). Con el flag ON en dev renderiza la pantalla con datos de ejemplo;
     el cableado a datos reales + tipos generados es qavante-web #487. */
  saludScreen: "/api/management/salud",
  /* Libro de Ventas v2 (rediseño aprobado 2026-07-13) — reordena la pantalla a la
     jerarquía del Inicio (respuesta de dueño arriba + tabla que sube + concentración
     lateral). Lo que lo enciende del todo son los comparativos del ritmo, que se
     piden como endpoint FE-first (aún no existe — ver libro-comparativos-contract).
     Con el flag OFF: el libro clásico intacto; sin el endpoint, los comparativos
     degradan (se omiten) y el hero muestra neto + sparkline del rango. */
  libroVentasV2: "/api/sii/rcv/ventas/comparativos",
  /* Libro de Compras v2 (mismo rediseño, análogo a Ventas) en `/pagar/facturas-
     recibidas`. Su endpoint de comparativos es el de compras. Flag independiente para
     poder encender Ventas y Compras por separado. */
  libroComprasV2: "/api/sii/rcv/compras/comparativos",
  /* Caja v2 (rediseño aprobado 2026-07-14) — Resumen con la curva de saldo que cae y toca
     el piso. Lo que lo distingue es la caja mínima (la línea del piso), su endpoint de
     gating. Reusa el reporte de caja (cashFlowReport) para los netos; con OFF, el reporte
     clásico queda intacto. La curva se deriva (saldo + netos) hasta que CC-API mande
     running_balance/min_cash. */
  cajaV2: "/api/treasury/cash-minimum",
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
