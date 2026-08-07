/* Capa de datos — Treasury: canonical categories + movimientos bancarios
 * (listado + clasificación).
 *
 * Contrato VIVO (verificado 2026-05-18, regla 16): el addendum §17.3 estaba
 * equivocado — `classify` es **PATCH** (no POST) y `ClassifyMovementRequest`
 * NO lleva `dimension_assignments` (asignar dimensión = endpoint aparte).
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { classificationRulesKeys } from "./classification-rules";
import { treasuryReportsKeys } from "./treasury-reports";
import { obligationKeys } from "./obligations";
import { pagosKeys } from "./pagos";
import type { components } from "./types";

export type CanonicalCategoryMeta = components["schemas"]["CanonicalCategoryMeta"];
export type CanonicalCategoriesResponse = components["schemas"]["CanonicalCategoriesResponse"];
export type BankMovement = components["schemas"]["BankMovement"];
/** Cobranza esperada bucketeada por vencimiento + overdue + sin fecha (CC-WEB Fase 2,
 *  #572). El `expected` de cada bucket = nominal ponderado por probabilidad de pago. */
export type CollectionForecastResponse = components["schemas"]["CollectionForecastResponse"];
export type CollectionProjectionResponse = components["schemas"]["CollectionProjectionResponse"];
export type ForecastBucket = components["schemas"]["ForecastBucket"];
/** Ciclo de conversión de caja: DSO (días de cobro) / DPO (días de pago) / CCC
 *  (CC-WEB Fase 2). Todos nullable si no hay ventana devengada suficiente. */
export type CashCycleResponse = components["schemas"]["CashCycleResponse"];
export type CashProjectionResponse = components["schemas"]["CashProjectionResponse"];
export type BankMovementsListResponse = components["schemas"]["BankMovementsListResponse"];
export type ClassifyMovementRequest = components["schemas"]["ClassifyMovementRequest"];
export type ApplyRulesResponse = components["schemas"]["ApplyRulesResponse"];
export type InternalTransferResponse = components["schemas"]["InternalTransferResponse"];
export type PayrollPaydayResponse = components["schemas"]["PayrollPaydayResponse"];
export type PutPayrollPaydayRequest = components["schemas"]["PutPayrollPaydayRequest"];
export type BankAccountItem = components["schemas"]["BankAccountItem"];
export type BankAccountsListResponse =
  components["schemas"]["app__core__treasury_schemas__BankAccountsListResponse"];
export type BiceAccount = components["schemas"]["BankAccountLinkStatus"];
export type BiceAccountsResponse =
  components["schemas"]["app__api__bank_ingest_bice__BankAccountsListResponse"];
export type CreateBankAccountRequest = components["schemas"]["CreateBankAccountRequest"];
export type SaldoResponse = components["schemas"]["SaldoResponse"];
export type CuentaSaldo = components["schemas"]["CuentaSaldo"];
/* Balance detallado por cuenta BICE: incluye la LÍNEA DE CRÉDITO (cupo aprobado / usado / disponible)
   + vencimiento del sobregiro — datos que `SaldoResponse` no trae. Tipos generados (regla 3). */
export type CuentaBalanceResponse = components["schemas"]["CuentaBalanceResponse"];
export type BalanceData = components["schemas"]["BalanceData"];
/* Tarjetas de crédito BICE (pantalla Banco): lista + cupo por tarjeta (national=CLP / international=USD,
   cada uno con totalQuota/spentQuota/availableQuota + facturado + venc). Tipos generados (regla 3). */
export type TarjetasResponse = components["schemas"]["TarjetasResponse"];
export type TarjetaCredito = components["schemas"]["TarjetaCredito"];
export type TarjetaSaldoResponse = components["schemas"]["TarjetaSaldoResponse"];
export type TarjetaMovimientosResponse = components["schemas"]["TarjetaMovimientosResponse"];
export type TarjetaMovimiento = components["schemas"]["TarjetaMovimiento"];
export type TarjetaSaldoData = components["schemas"]["TarjetaSaldoData"];

export interface BankMovementsParams {
  /** 'unclassified' | 'classified' | undefined (todos). */
  status?: string;
  /** Período YYYY-MM. */
  period?: string;
  /** Dirección del flujo: 'credit' (cobrar) / 'debit' (pagar). Filtro server-side
   *  pendiente en el backend (handoff CC-API 2026-07-04); hasta que se publique,
   *  las vistas filtran client-side. La fontanería queda lista: cuando exista el
   *  param, el backend ignora los desconocidos, así que pasarlo es no-op seguro. */
  direction?: "credit" | "debit";
  limit?: number;
  offset?: number;
}

/* Query keys co-locados por dominio — patrón vigente del repo (`usersKeys` en
   users.ts), ratificado por ADR-0007 ("seguir el patrón existente"). */
export const treasuryKeys = {
  all: ["treasury"] as const,
  canonicalCategories: () => [...treasuryKeys.all, "canonical-categories"] as const,
  bankMovements: (params: BankMovementsParams = {}) =>
    [...treasuryKeys.all, "bank-movements", params] as const,
  bankAccounts: () => [...treasuryKeys.all, "bank-accounts"] as const,
  biceAccounts: () => [...treasuryKeys.all, "bice-accounts"] as const,
  biceSaldo: () => [...treasuryKeys.all, "bice-saldo"] as const,
  biceCuentaBalance: (numeroCuenta: string) =>
    [...treasuryKeys.all, "bice-cuenta-balance", numeroCuenta] as const,
  biceTarjetas: () => [...treasuryKeys.all, "bice-tarjetas"] as const,
  biceTarjetaSaldo: (op: string) => [...treasuryKeys.all, "bice-tarjeta-saldo", op] as const,
  biceTarjetaMovimientos: (op: string) =>
    [...treasuryKeys.all, "bice-tarjeta-movimientos", op] as const,
  payrollPayday: () => [...treasuryKeys.all, "payroll-payday"] as const,
  collectionForecast: () => [...treasuryKeys.all, "collection-forecast"] as const,
  collectionProjection: () => [...treasuryKeys.all, "collection-projection"] as const,
  cashCycle: () => [...treasuryKeys.all, "cash-cycle"] as const,
  cashProjection: (horizonDays: number) =>
    [...treasuryKeys.all, "cash-projection", horizonDays] as const,
};

/** `GET /api/treasury/collection-forecast` — cobranza esperada por bucket de
 *  vencimiento (Fase 2 del Inicio v2). Enciende la card Cobranza realizable. Cookie
 *  auth. NO retry (si la fuente falla, la vista degrada al total del summary). */
export function useCollectionForecast() {
  return useQuery({
    queryKey: treasuryKeys.collectionForecast(),
    queryFn: () => api.get<CollectionForecastResponse>("/api/treasury/collection-forecast"),
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/treasury/collection-projection` — proyección de cobros fechada por el COMPORTAMIENTO real
 *  del pagador (ADR-0083 B2). `vs_nominal.behavior_shift_days` = cuántos días, en promedio (ponderado
 *  por monto), pagan tus clientes respecto del vencimiento nominal (+ = después). Cookie auth. NO retry
 *  (si falla, la vista omite el insight; no inventa un desfase). */
export function useCollectionProjection(enabled = true) {
  return useQuery({
    queryKey: treasuryKeys.collectionProjection(),
    queryFn: () => api.get<CollectionProjectionResponse>("/api/treasury/collection-projection"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/treasury/cash-projection?horizon_days=` — proyección ÚNICA de caja (modelo ratificado
 *  #770/ADR-0085): saldo hoy + serie forward a cierre de día + días de caja + punto de quiebre (con
 *  causas) + escenario duro + vencido. Es la FUENTE ÚNICA del medidor (reemplaza la reproyección FE).
 *  Cookie auth. NO retry (si falla, el medidor muestra "sin dato", no una curva inventada). */
export function useCashProjection(horizonDays = 90) {
  return useQuery({
    queryKey: treasuryKeys.cashProjection(horizonDays),
    queryFn: () =>
      api.get<CashProjectionResponse>(
        `/api/treasury/cash-projection?horizon_days=${encodeURIComponent(horizonDays)}`,
      ),
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/treasury/cash-cycle` — ciclo de caja (DSO/DPO/CCC) para la señal de
 *  gestión del Inicio v2. Cookie auth. NO retry (degrada solo). */
export function useCashCycle() {
  return useQuery({
    queryKey: treasuryKeys.cashCycle(),
    queryFn: () => api.get<CashCycleResponse>("/api/treasury/cash-cycle"),
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/bice/saldo` — saldo contable + disponible por cuenta (CLP/USD).
 *  `/api/bice/*` ya acepta cookie (CC-API lo migró a require_session — sondeado 2026-08-03: `no_session`,
 *  no "Falta X-Api-Key"), así que el flag `bankBalances` ya puede encenderse. `skipAuthRetry`: un 401 acá
 *  NO debe expulsar al login (cae como error de la tarjeta). Tipos generados. */
export function useBiceSaldo(enabled = true) {
  return useQuery({
    queryKey: treasuryKeys.biceSaldo(),
    queryFn: () => api.get<SaldoResponse>("/api/bice/saldo", { skipAuthRetry: true }),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/bice/cuentas/{numeroCuenta}/balance` (una por cuenta, en paralelo) — el balance detallado
 *  con la LÍNEA DE CRÉDITO (cupo/usado/disponible + venc. sobregiro), que `SaldoResponse` no trae. Se
 *  compone sobre los `numeroCuenta` (tokens) que devuelve `useBiceSaldo`. Gateado por `enabled` (el flag
 *  `bankBalances`) → con `enabled=false` no dispara ningún request. `skipAuthRetry`: un 401 acá NO expulsa
 *  al login. Devuelve un mapa `numeroCuenta → BalanceData` (solo las que respondieron con data). */
export function useBiceCuentasBalances(
  numeros: string[],
  enabled = true,
): { balancePorCuenta: Map<string, BalanceData>; isLoading: boolean; isError: boolean } {
  const queries = useQueries({
    queries: numeros.map((numero) => ({
      queryKey: treasuryKeys.biceCuentaBalance(numero),
      queryFn: () =>
        api.get<CuentaBalanceResponse>(`/api/bice/cuentas/${encodeURIComponent(numero)}/balance`, {
          skipAuthRetry: true,
        }),
      enabled: enabled && numero !== "",
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
  const balancePorCuenta = new Map<string, BalanceData>();
  numeros.forEach((numero, i) => {
    const data = queries[i]?.data?.data;
    if (data) balancePorCuenta.set(numero, data);
  });
  return {
    balancePorCuenta,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

/** `GET /api/bice/tarjetas` — tarjetas de crédito del tenant (operationNumber + producto + titular +
 *  activa). Cookie (bice ya cookie-open). Gateado por `enabled`. NO retry; `skipAuthRetry`. */
export function useBiceTarjetas(enabled = true) {
  return useQuery({
    queryKey: treasuryKeys.biceTarjetas(),
    queryFn: () => api.get<TarjetasResponse>("/api/bice/tarjetas", { skipAuthRetry: true }),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/bice/tarjetas/{op}/saldo` (una por tarjeta, en paralelo) — el cupo (national=CLP /
 *  international=USD) de cada tarjeta. Se compone sobre los `operationNumber` de `useBiceTarjetas`.
 *  Gateado por `enabled`. Devuelve un mapa `operationNumber → TarjetaSaldoData`. */
export function useBiceTarjetasSaldos(
  ops: string[],
  enabled = true,
): { saldoPorTarjeta: Map<string, TarjetaSaldoData>; isLoading: boolean; isError: boolean } {
  const queries = useQueries({
    queries: ops.map((op) => ({
      queryKey: treasuryKeys.biceTarjetaSaldo(op),
      queryFn: () =>
        api.get<TarjetaSaldoResponse>(`/api/bice/tarjetas/${encodeURIComponent(op)}/saldo`, {
          skipAuthRetry: true,
        }),
      enabled: enabled && op !== "",
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
  const saldoPorTarjeta = new Map<string, TarjetaSaldoData>();
  ops.forEach((op, i) => {
    const data = queries[i]?.data?.data;
    if (data) saldoPorTarjeta.set(op, data);
  });
  return {
    saldoPorTarjeta,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

/** `GET /api/bice/tarjetas/{op}/movimientos` — los MOVIMIENTOS (cargos) de una tarjeta de crédito
 *  (`{date, type, description, amount, currency, state, installmentsDescription}`). Para el detalle de
 *  la tarjeta en Banco. Cookie (bice cookie-open). NO retry; `skipAuthRetry`; cacheado 5min. */
export function useBiceTarjetaMovimientos(op: string, enabled = true) {
  return useQuery({
    queryKey: treasuryKeys.biceTarjetaMovimientos(op),
    queryFn: () =>
      api.get<TarjetaMovimientosResponse>(
        `/api/bice/tarjetas/${encodeURIComponent(op)}/movimientos`,
        { skipAuthRetry: true },
      ),
    enabled: enabled && Boolean(op),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/treasury/bank-accounts` — cuentas del tenant con su moneda. Para el
 *  selector de cuenta en Caja (no mezclar CLP/USD) y el formateo por moneda. */
export function useBankAccounts() {
  return useQuery({
    queryKey: treasuryKeys.bankAccounts(),
    queryFn: () => api.get<BankAccountsListResponse>("/api/treasury/bank-accounts"),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/bank-movements/bice/accounts` — cuentas que BICE trae, con su estado
 *  de vínculo. `linked_bank_account_id === null` = en cuarentena (por vincular).
 *  Timeout de 12s: el endpoint puede colgarse/tardar (lee del banco) → sin esto
 *  la card se quedaba cargando para siempre; con el abort cae en error + reintentar. */
export function useBiceAccounts() {
  return useQuery({
    queryKey: treasuryKeys.biceAccounts(),
    queryFn: async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12_000);
      try {
        return await api.get<BiceAccountsResponse>("/api/bank-movements/bice/accounts", {
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** `POST /api/treasury/bank-accounts` — alta de cuenta Qavante (owner/admin).
 *  Devuelve la cuenta creada (con `id`). Invalida el listado de cuentas. */
export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBankAccountRequest) =>
      api.post<BankAccountItem>("/api/treasury/bank-accounts", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: treasuryKeys.bankAccounts() }),
  });
}

/** `POST /api/bank-movements/bice/accounts/{external_id}/link` — vincula una
 *  cuenta BICE a una `treasury.bank_accounts`. Invalida BICE + cuentas. */
export function useLinkBiceAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ externalId, bankAccountId }: { externalId: string; bankAccountId: string }) =>
      api.post(`/api/bank-movements/bice/accounts/${encodeURIComponent(externalId)}/link`, {
        body: { bank_account_id: bankAccountId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.biceAccounts() });
      qc.invalidateQueries({ queryKey: treasuryKeys.bankAccounts() });
    },
  });
}

/** `GET /api/treasury/canonical-categories` — metadata congelada (P4-4). */
export function useCanonicalCategories() {
  return useQuery({
    queryKey: treasuryKeys.canonicalCategories(),
    queryFn: () => api.get<CanonicalCategoriesResponse>("/api/treasury/canonical-categories"),
    staleTime: 60 * 60 * 1000, // 1 h: contrato congelado, no cambia en sesión
    retry: false,
  });
}

function buildBankMovementsQuery(p: BankMovementsParams): string {
  const s = new URLSearchParams();
  if (p.status) s.set("status", p.status);
  if (p.period) s.set("period", p.period);
  if (p.direction) s.set("direction", p.direction);
  if (p.limit != null) s.set("limit", String(p.limit));
  if (p.offset != null) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /api/bank-movements` — listado paginado (filtros status/period). */
export function useBankMovements(params: BankMovementsParams = {}) {
  return useQuery({
    queryKey: treasuryKeys.bankMovements(params),
    queryFn: () =>
      api.get<BankMovementsListResponse>(`/api/bank-movements${buildBankMovementsQuery(params)}`),
    staleTime: 30_000,
    retry: false,
  });
}

/** Meses `YYYY-MM` en el rango [from, to] inclusive (máx 24, guarda anti-runaway). PURO. */
export function monthsInRange(from?: string, to?: string): string[] {
  if (!from || !to) return [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return [];
  const out: string[] = [];
  let y = fy;
  let m = fm;
  for (let i = 0; i < 24 && (y < ty || (y === ty && m <= tm)); i += 1) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export interface UnclassifiedSummary {
  /** Cantidad de movimientos sin clasificar en el rango. */
  count: number;
  /** Suma de las ENTRADAS sin clasificar (lo que NO está reflejado en el flujo "committed"). */
  inflow: number;
  isLoading: boolean;
}

/** Resumen de movimientos SIN CLASIFICAR en el rango (una consulta por mes, `useQueries`). El reporte
 *  de caja usa el layer "committed" = solo lo clasificado → esto expone cuánto queda AFUERA, para
 *  avisarlo honesto (validación real Tooxs 2026-07-22: julio tenía $61,5M sin clasificar vs $1,6M
 *  clasificado). El `inflow` suma lo fetcheado por mes (limit 500) — exacto salvo backlog gigante. */
export function useUnclassifiedInRange(from?: string, to?: string): UnclassifiedSummary {
  const months = monthsInRange(from, to);
  const results = useQueries({
    queries: months.map((period) => {
      const params: BankMovementsParams = { status: "unclassified", period, limit: 500 };
      return {
        queryKey: treasuryKeys.bankMovements(params),
        queryFn: () =>
          api.get<BankMovementsListResponse>(
            `/api/bank-movements${buildBankMovementsQuery(params)}`,
          ),
        staleTime: 30_000,
        retry: false,
      };
    }),
  });
  let count = 0;
  let inflow = 0;
  let isLoading = false;
  for (const r of results) {
    if (r.isLoading) isLoading = true;
    const data = r.data;
    if (!data) continue;
    count += data.total ?? data.items.length;
    for (const mv of data.items) {
      const a = Number(mv.amount) || 0;
      const esEntrada = mv.direction ? mv.direction === "credit" : a > 0;
      if (esEntrada) inflow += Math.abs(a);
    }
  }
  return { count, inflow, isLoading };
}

/** `PATCH /api/bank-movements/{id}/classify` — clasifica/reclasifica.
 *  `management_account_id` es obligatorio (422 si falta). Invalida los
 *  listados de movimientos al éxito. */
export function useClassifyBankMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movementId, body }: { movementId: string; body: ClassifyMovementRequest }) =>
      api.patch<BankMovement>(`/api/bank-movements/${movementId}/classify`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      /* Clasificar con `create_rule:true` crea una regla, y SIEMPRE cambia los
         financial_impacts que alimentan el cash-flow report. Ambos viven en
         namespaces de query-key distintos (`classification-rules`,
         `treasury-reports`) que la invalidación de `treasury` no alcanza por
         prefijo → invalidarlos aparte (code-review #3). */
      qc.invalidateQueries({ queryKey: classificationRulesKeys.all });
      qc.invalidateQueries({ queryKey: treasuryReportsKeys.all });
    },
  });
}

/** `POST /api/treasury/bank-movements/apply-rules` — aplica las reglas de
 *  clasificación activas a TODOS los movimientos sin clasificar (batch
 *  determinista, idempotente). Solo clasifica lo que matchea una regla REAL
 *  (respeta "no default classification"). Al éxito puebla los financial_impacts
 *  que alimentan los reportes de caja → invalida movimientos + reglas +
 *  reportes. 403 si el rol no tiene permiso de escritura (ADR-0028). */
export function useApplyRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ApplyRulesResponse>("/api/treasury/bank-movements/apply-rules"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      qc.invalidateQueries({ queryKey: classificationRulesKeys.all });
      qc.invalidateQueries({ queryKey: treasuryReportsKeys.all });
    },
  });
}

/** `POST /api/treasury/bank-movements/detect-internal-transfers` (ADR-0067 A1) — detecta pares
 *  cargo↔abono entre CUENTAS PROPIAS del tenant y los clasifica como `internal_bank_transfer`
 *  (no son ingreso ni gasto, netean a cero). Devuelve `{evaluados, pares, clasificados}`. Como
 *  cambia clasificaciones + financial_impacts, invalida movimientos + reglas + reportes. */
export function useDetectInternalTransfers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<InternalTransferResponse>("/api/treasury/bank-movements/detect-internal-transfers"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      qc.invalidateQueries({ queryKey: classificationRulesKeys.all });
      qc.invalidateQueries({ queryKey: treasuryReportsKeys.all });
    },
  });
}

/** `GET /api/treasury/payroll-payday` (ADR-0056) — día de pago de remuneraciones
 *  del tenant (1-31, o null = último día hábil). Define el vencimiento de la
 *  obligación "Remuneraciones" en Pagar. */
export function usePayrollPayday() {
  return useQuery({
    queryKey: treasuryKeys.payrollPayday(),
    queryFn: () => api.get<PayrollPaydayResponse>("/api/treasury/payroll-payday"),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `PUT /api/treasury/payroll-payday` (owner/admin) — setea el día de pago
 *  (`payday_day` 1-31, o null para volver al default = último día hábil).
 *  Invalida el payday + las obligaciones (cambia el vencimiento de Remuneraciones). */
export function useSetPayrollPayday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PutPayrollPaydayRequest) =>
      api.put<PayrollPaydayResponse>("/api/treasury/payroll-payday", { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.payrollPayday() });
      // Cambiar el día de pago mueve el vencimiento de la obligación
      // "Remuneraciones" (treasury.payables) → refrescar accounts-payable.
      qc.invalidateQueries({ queryKey: pagosKeys.accountsPayable() });
      qc.invalidateQueries({ queryKey: obligationKeys.all });
    },
  });
}
