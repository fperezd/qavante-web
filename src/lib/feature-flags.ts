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
  "cajaV3",
  "pagarV2",
  "cobrarV2",
  "reconciliationReview",
  "bancoScreen",
  "payrollReconcileBoard",
  "bancoConciliacion",
  "pulsoObjetivo",
  "comportamientoPago",
  "inicioWidgets",
  "inicioAgenda",
  "gestionDashboard",
  "cajaDashboard",
  "presupuesto",
  "mcp",
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
  /* Resultado Operacional de Gestión (Sprint C5). Endpoint VIVO en prod (acepta cookie, sondeado
     2026-07-17). El flag está ON; el dato de fondo aún excluye remuneraciones (gap CC-API, A1). */
  operationalResult: "/api/management/operational-result",
  /* Cobrar — cuentas por cobrar (Sprint C4). Endpoint VIVO en prod (acepta cookie). Flag ON. */
  accountsReceivable: "/api/treasury/accounts-receivable",
  /* Pagar — cuentas por pagar (Sprint C4). Endpoint VIVO en prod (acepta cookie). Flag ON. */
  accountsPayable: "/api/treasury/accounts-payable",
  /* Inicio Ejecutivo (Sprint C8) — el dashboard agregado. Endpoint VIVO en prod (acepta cookie). */
  dashboardSummary: "/api/dashboard/summary",
  /* Inicio Ejecutivo v2 (rediseño aprobado 2026-07-12) — consume la misma fuente base
     (`/api/dashboard/summary`) que dashboardSummary; su endpoint de gating `collection-forecast`
     también está VIVO (acepta cookie, sondeado). Sigue OFF por otra razón: los campos que lo
     DISTINGUEN (key_obligations/cash_sparkline/cash_delta_pct) NO existen en el schema (gap CC-API,
     B2) → hoy el v2 se vería igual al v1. Encender recién cuando esos campos lleguen. */
  inicioEjecutivoV2: "/api/treasury/collection-forecast",
  /* Pulso detalle (Sprint C6/C7) — "¿por qué está así mi Pulso?". Endpoint VIVO en prod (acepta
     cookie). Flag ON. El cálculo del score es del backend; el FE solo muestra. */
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
     `/api/buk/employees` acepta cookie de sesión — sondeado contra prod el 16-07-2026 (devuelve
     `no_session`, no "Falta X-Api-Key."). El flag ya está ON. La duda del comentario viejo
     ("podría ser api-key-only") quedó saldada. */
  remuneraciones: "/api/buk/employees",
  /* Saldos de las cuentas de banco (Caja): saldo contable + disponible por cuenta (CLP/USD) + la LÍNEA
     DE CRÉDITO (cupo/usado/disponible + venc. sobregiro, del balance por cuenta). `/api/bice/*` YA acepta
     cookie (CC-API lo migró a require_session — sondeado 2026-08-03: `no_session`), así que el flag ya
     puede encenderse en prod (editar wrangler.toml). Ver STATE_OF_THE_TRAIN. */
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
  /* Caja v3 (rediseño visual 2026-07-20) — reemplaza la curva de "Saldo proyectado" (una recta
     sobre el cash-flow histórico, que no proyecta el futuro) por un MEDIDOR de días de caja +
     CASCADA de próximos movimientos, ambos derivados de los VENCIMIENTOS (cobranzas del maestro AR
     + obligaciones del maestro AP + payroll/tax/rent/debt/leasing de accounts-payable). Su endpoint
     de gating es la proyección de caja forward (FE-first, aún no existe — hoy el FE la deriva de los
     vencimientos, mismo motor que Cobrar/Pagar). Con ON reemplaza la curva del Resumen; hoy OFF, la
     curva clásica queda intacta. Estado honesto si no hay proyección forward. */
  cajaV3: "/api/treasury/cash-projection",
  /* Pagar v2 (rediseño aprobado 2026-07-14) — respuesta de dueño (cuánto debe pagar +
     ¿la caja alcanza?) + brecha de caja + las 3 del mes + vencimientos con postergabilidad
     + mayores compromisos. Reusa `accounts-payable` (accountsPayable) para los datos; lo que
     lo DISTINGUE y lo enciende del todo es la postergabilidad por ítem (hoy HEURÍSTICA en el
     FE) y el plan de pago — ese es su endpoint de gating (FE-first, aún no existe). Con el
     flag ON tiene prioridad sobre accountsPayable (mismo dato base); hoy OFF, el Pagar
     clásico queda intacto. */
  pagarV2: "/api/treasury/payment-plan",
  /* Cobrar v2 (rediseño 2026-07-19) — respuesta de dueño: "a quién le cobras primero" + acciones
     reales de cobranza (copiar recordatorio en chileno, WhatsApp/mail, marcar gestionado persistido
     en prefs). Reusa `accounts-receivable` (accountsReceivable) para los datos; degrada honesto en
     dos modos según haya o no vencimientos del SII (urgencia vs. concentración). Lo que lo ENCIENDE
     del todo es el plan de cobranza por vencimiento (FE-first, aún no existe) — ese es su endpoint de
     gating, el que lo pasa de "concentración" a "urgencia". Con ON tiene prioridad sobre la vista
     clásica de Cobrar; hoy OFF, el Cobrar clásico queda intacto. */
  cobrarV2: "/api/treasury/collection-plan",
  /* Cola de conciliación (ADR-0036/0042) — el motor auto-aplica los matches con score >=90 y deja
     los 60-90 en una cola de revisión de 1 clic (confirmar/rechazar/conciliar todas). La pantalla
     nueva la consume; su endpoint de gating es la cola misma. LIVE en prod desde 2026-07-17
     (`NEXT_PUBLIC_FF_RECONCILIATION_REVIEW="true"` en wrangler.toml). */
  reconciliationReview: "/api/treasury/reconciliation/review",
  /* Pantalla Banco (2026-08-04) — los PRODUCTOS del tenant por banco: cuentas corrientes (saldo + línea
     de crédito) + tarjetas de crédito (cupo). Consume `/api/bice/*` (ya cookie-open). Gated OFF hasta
     validar la UX con Fernando; encender = editar wrangler.toml. */
  bancoScreen: "/api/bice/tarjetas",
  /* Conciliación de sueldos ACCIONABLE en Remuneraciones (#835) — el board del backend
     (`/api/admin/treasury/payroll-settlements/{period}`) es la fuente de verdad; deja conciliar
     una-a-una / varias marcadas y DESASIGNAR (revert). Los 3 endpoints (settlements/reconcile/revert)
     están deployados (2026-08-04, qavante-api #826/#827). Gated OFF hasta que Fernando valide al peso
     con su sesión que el shape del board/reconcile (objetos genéricos en el OpenAPI) calza con lo que
     el FE normaliza; encender = editar wrangler.toml. Con OFF, la Conciliación pasiva por-monto queda
     intacta (cero regresión). */
  payrollReconcileBoard: "/api/admin/treasury/payroll-settlements/{period}",
  /* Conciliación POR movimiento en el detalle de una cuenta de Banco (Fase 2, 2026-08-06) — cada
     movimiento "Por conciliar" con match propuesto (de la cola `reconciliation/review`, cruzada por
     movement_id con la cuenta) ofrece "Conciliar" / "Rechazar" + un tab "Sugerencias". Muta (confirm),
     así que gated OFF hasta validar al peso el path confirm con la sesión de Fernando (bug histórico
     `confirm_review`). Con OFF, el detalle queda read-only (Fase 1, cero regresión). Su endpoint de
     gating es el confirm POR movimiento (lo que lo distingue de `reconciliationReview`, que solo lee la
     cola). Encender = editar wrangler.toml. */
  bancoConciliacion: "/api/treasury/reconciliation/{movement_id}/confirm",
  /* Pulso configurable por OBJETIVO (2026-08-06) — el dueño elige qué prioriza la empresa (cuidar la
     caja / cumplir pagos / crecer / equilibrado) y eso re-pondera los ejes del Pulso. El FE captura el
     objetivo (persistido en prefs) y lo manda como `?objetivo=` a `/api/management/pulso`; el
     re-ponderado del score lo hace CC-API (el FE no calcula Pulso). Gating endpoint = ese param.
     OFF hasta que el backend honre el parámetro (hoy lo ignora → devuelve el equilibrado, sin número
     falso). Con OFF, el Pulso detalle queda como está (cero regresión). Encender = editar wrangler. */
  pulsoObjetivo: "/api/management/pulso?objetivo=",
  /* Comportamiento de pago (2026-08-06) — insight en Ciclo de caja: complementa el DSO con el desfase
     REAL vs vencimiento (`behavior_shift_days` de `/api/treasury/collection-projection`, agregado de
     cobros). Primer paso hacia la "temporalidad" que pidió Fernando; el detalle POR CONTRAPARTE es
     brecha de CC-API (qavante-api #858). OFF hasta validar el dato al peso; con OFF Ciclo de caja queda
     igual (cero regresión). Encender = editar wrangler. */
  comportamientoPago: "/api/treasury/collection-projection",
  /* Personalizar el Inicio (2026-08-08) — el dueño PRENDE/APAGA las tarjetas (mover ya lo hace el
     DraggableCard). Fundación del norte "la mañana del dueño": mover + on/off + catálogo. Persiste en
     el blob de prefs (clave `inicio_widget_hidden`, molde `widget-order`). Gating endpoint = las prefs
     que lo persisten. OFF hasta validar; con OFF el Inicio v2 queda igual (cero regresión). Requiere
     `inicioEjecutivoV2` ON para verse (el v2 gatea la pantalla). Encender = editar wrangler. */
  inicioWidgets: "/api/me/preferences",
  /* Agenda de las próximas 2 semanas en el Inicio (2026-08-08) — tarjeta que compone los vencimientos
     forward (cobros del maestro AR + pagos AP + F29/Previred/sueldos/arriendo) a 14 días, agrupados por
     semana. Reusa el motor de la cascada de Caja. Requiere `inicioEjecutivoV2` ON para verse; se puede
     mover/apagar como cualquier widget (framework `inicioWidgets`). OFF hasta validar; con OFF el Inicio
     queda igual (cero regresión). Encender = editar wrangler. */
  inicioAgenda: "/api/sii/rcv/ventas",
  /* Gestión como tablero REORDENABLE (2026-08-08, piloto de "reordenar cards en otras pantallas"): las
     secciones de la vista v2 (resultado/hero, márgenes, comparativos, cascada, drivers, tendencia, pulso,
     confianza) se muestran como cards movibles/apagables (mismo motor iPad del Inicio) con orden/visibilidad
     por `gestion_widget_*` en prefs. OFF hasta que Fernando lo valide; con OFF la Gestión queda IGUAL (el
     informe/matriz de siempre) → cero regresión. Encender = editar wrangler. */
  gestionDashboard: "/api/management/operational-result/breakdown",
  /* Caja como landing REORDENABLE (2026-08-08, piloto): las secciones de la landing (resumen/medidor,
     saldos en banco, movimientos, proyectada) como bloques movibles/apagables (motor iPad del Inicio),
     orden/visibilidad por `caja_widget_*`. OFF hasta validar; con OFF la Caja queda IGUAL → cero
     regresión. Encender = editar wrangler. */
  cajaDashboard: "/api/bice/cuentas",
  /* Pantalla Presupuesto propositivo (ADR-0091, 2026-08-09): "cómo vas" contra el plan que Qavante
     PROPONE desde el histórico (POST budget/propose) + ajuste "+% ventas". Consume budget-vs-actual.
     Requiere el backend #870 (ya en main). Encender = editar wrangler. */
  presupuesto: "/api/planning/budget-vs-actual",
  /* Administración → MCP (ADR-0092): conectar la empresa a un asistente LLM (ChatGPT/Claude) vía el
     server MCP de Qavante. Gestiona las API-keys de la empresa (crear/listar/revocar). Requiere el
     backend #882/#888 (ya en main). Gated OFF hasta que Fernando lo valide. */
  mcp: "/api/mcp/connection",
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
