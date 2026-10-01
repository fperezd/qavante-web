import { AMOUNT_UNKNOWN_QUARANTINE } from "@/lib/formatters/amount";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { dashboardKeys } from "./dashboard";
import { invalidateCashDecisionBrief } from "./cash-decision-brief";
import type { components, operations } from "./types";
import { ApiError } from "./errors";

/* Capa de datos — Pagar / Cuentas por pagar (Sprint C4, Documento Maestro
   §7.4).

   `GET /api/treasury/accounts-payable` YA existe en el backend. Igual que
   accounts-receivable (ADR-0055 F1): con el devengado (treasury.payables,
   poblado por `sync-rcv`) vacío devuelve honesto `data_state:"partial"` +
   `missing_sources` en vez de un $0 confiado. Gated por `accountsPayable`.

   Montos string-decimal (igual que el resto del API treasury). */

type ContractPayableItem = components["schemas"]["PayableItem"];
type ContractAccountsPayableResponse = components["schemas"]["AccountsPayableResponse"];

export type PaymentCategory = ContractPayableItem["category"];

/** Compatibilidad de presentación durante el rollout: el guard HTTP exige estos campos,
 * pero fixtures y consumidores históricos todavía pueden construirlos sin ellos. */
export interface PayableItem extends Omit<
  ContractPayableItem,
  "id" | "currency" | "currency_status" | "reclamado"
> {
  /** UUID estable del payable. Comparte espacio de identidad con los pares de anomalías (#318/#322).
   * Opcional sólo durante el despliegue gradual: las pantallas que correlacionan anomalías deben
   * abstenerse si falta; nunca reconstruirlo desde campos de negocio. */
  id?: string | null;
  /** Proveedor u obligación (ej. "Arriendo bodega", "IVA / F29"). */
  label: string;
  category: PaymentCategory;
  /** Fecha estimada de pago (ISO date "YYYY-MM-DD"). */
  due_date: string;
  /** Saldo del pago. `null` = DESCONOCIDO porque el documento está en cuarentena de
   *  conciliación (qavante-api#907, #687): viene con `amount_unknown_reason`. Nunca es 0. */
  amount: string | null;
  /** `unknown`: sin vencimiento confirmado no hay urgencia calculable (qavante-api#566). */
  criticality: PayableCriticality;
  /** Fuente del dato en lenguaje humano (ej. "SII", "Previred", "Manual"). */
  source: string;
  /** Clave natural (ej. 'payroll-202606' → deriva el período para el detalle). */
  source_external_id?: string | null;
  /** Identidad de la contraparte (CC-WEB #2, nullables). Razón social del proveedor. */
  counterparty_name?: string | null;
  /** RUT de la contraparte con DV. Null en obligaciones sin RUT (nómina). */
  counterparty_rut?: string | null;
  /** Folio del DTE. Null cuando la obligación no es un DTE. */
  folio?: number | null;
  /** Código de tipo DTE del SII (33=Factura, 46=F.Compra, 61=NC…). Null si no aplica. */
  tipo_dte?: number | null;
  /** Moneda ISO del `amount`; `null` o ausencia no acreditan una unidad monetaria. */
  currency?: string | null;
  /**
   * Durante el rollout, fixtures históricos no siempre traen este campo. Los datos HTTP se
   * validan contra el contrato generado antes de llegar a la pantalla; consumidores deben
   * tratar ausencia exactamente como moneda no verificable, nunca como CLP implícito.
   */
  currency_status?: ContractPayableItem["currency_status"];
  /** `amount` en CLP cuando `currency` != CLP; null si ya es CLP. */
  amount_clp?: string | null;
  /** Monto estimado por el backend (ej. F29 del período en curso antes de que el SII lo emita;
   *  Previred proyectado). El FE lo muestra con el badge "Estimación" (fechas-clave-mes,
   *  vencimientos-timeline).
   *
   *  ⚠️ FE-first: **el backend NO manda este campo**. Verificado contra el openapi vivo de prod el
   *  16-07-2026 — `PayableItem` trae label, category, due_date, amount, criticality, source,
   *  source_external_id, counterparty_name, counterparty_rut, folio, tipo_dte, currency,
   *  amount_clp. No hay `estimated`. Como esta interfaz es hand-rolled, el compilador igual acepta
   *  `it.estimated`: llega `undefined` → `estimado: false` → **el badge nunca se ve en prod**.
   *
   *  No es un bug del FE: el cálculo del F29/Previred estimado está escalado a CC-API
   *  (STATE_OF_THE_TRAIN, 2026-07-14). El día que lo manden, el badge aparece solo. Antes decía
   *  "CC-API #TBD", que no apuntaba a nada. */
  estimated?: boolean;
  /** La factura fue RECLAMADA en el SII por el receptor (su monto ya viene en $0). El FE la
   *  muestra marcada donde aparezca — transparencia, no excluir en silencio (ADR-0079). En el
   *  contrato generado es requerida con default `false`; acá opcional porque esta interfaz es
   *  hand-rolled y los fixtures viejos no la traen. */
  reclamado?: boolean;
}

/** Desglose crudo del total por moneda (sin convertir), para "(CLP $X + USD $Y)".
 *  CC-API #560. CLP primero. */
/**
 * Capa de presentación compatible con fixtures previos al campo de procedencia. En datos
 * recibidos, el contrato HTTP exige `currency_status`; el render nunca trata su ausencia
 * como una moneda verificada.
 */
export type PayableCurrencyTotal = Omit<
  components["schemas"]["PayableCurrencyTotal"],
  "currency_status"
> & {
  currency_status?: components["schemas"]["PayableCurrencyTotal"]["currency_status"];
};
export type PayableAggregateSummary = components["schemas"]["PayableAggregateSummary"];
export type PayableFilterMetadata = components["schemas"]["PayableFilterMetadata"];
export type PayablePayrollCoverage = components["schemas"]["PayablePayrollCoverage"];
export type PayablePayrollHighlight = components["schemas"]["PayablePayrollHighlight"];

type LegacyRequiredAccountsPayableFields =
  | "total"
  | "due_7d"
  | "due_14d"
  | "due_30d"
  | "confidence"
  | "data_state"
  | "generated_at";

/** Shape compatible para pantallas legacy; sólo el boundary D02 usa la variante estricta. */
export type AccountsPayableResponse = Pick<
  ContractAccountsPayableResponse,
  LegacyRequiredAccountsPayableFields
> &
  Partial<Omit<ContractAccountsPayableResponse, LegacyRequiredAccountsPayableFields | "items">> & {
    items?: PayableItem[];
  };

export type D02AccountsPayableResponse = Omit<ContractAccountsPayableResponse, "items"> & {
  items?: PayableItem[];
};

export type AccountsPayableQuery = NonNullable<
  operations["treasury_accounts_payable"]["parameters"]["query"]
>;

/** Par read-only que el backend marcó para revisión humana sobre todo el devengado elegible.
 * No permite reconstruir identidad desde texto, RUT, monto ni fecha. */
export interface PayableDuplicatePair {
  payable_id: string;
  duplicate_payable_id: string;
}

export interface PayableDuplicateAnomaliesResponse {
  items: PayableDuplicatePair[];
}

export const pagosKeys = {
  all: ["pagos"] as const,
  accountsPayable: (query: AccountsPayableQuery = {}) =>
    [...pagosKeys.all, "accounts-payable", normalizeAccountsPayableQuery(query)] as const,
  payableDuplicateAnomalies: () => [...pagosKeys.all, "accounts-payable", "anomalies"] as const,
};

/** Los únicos saltos que permite el contrato de Postergar. */
export type PostponeDays = components["schemas"]["PostponePayableRequest"]["days"];
export type PostponePayableResponse = components["schemas"]["PostponePayableResponse"];

export interface PostponePayableInput {
  payableId: string;
  days: PostponeDays;
}

/**
 * `POST /api/treasury/accounts-payable/{payable_id}/postpone`.
 *
 * La identidad viene de `cash-projection.punto_quiebre.causas[].payable_id`: nunca se
 * reconstruye a partir de glosa, monto o fecha. Tras éxito se invalida el listado de pagos,
 * la proyección y el resumen, porque los tres pueden cambiar con la nueva fecha.
 */
export function usePostponePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payableId, days }: PostponePayableInput) =>
      api.post<PostponePayableResponse>(
        `/api/treasury/accounts-payable/${encodeURIComponent(payableId)}/postpone`,
        { body: { days } },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pagosKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["treasury", "cash-projection"] }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
        invalidateCashDecisionBrief(queryClient),
      ]);
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

interface DecimalValue {
  negative: boolean;
  digits: string;
  scale: number;
}

function decimal(value: unknown): DecimalValue | null {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  return { negative: negative && !/^0+$/.test(digits), digits, scale: fraction.length };
}

function scaledDigits(value: DecimalValue, scale: number): string {
  return `${value.digits}${"0".repeat(scale - value.scale)}`.replace(/^0+(?=\d)/, "");
}

function compareMagnitude(a: string, b: string): number {
  return a.length === b.length ? (a === b ? 0 : a < b ? -1 : 1) : a.length < b.length ? -1 : 1;
}

function addMagnitude(a: string, b: string): string {
  let carry = 0;
  let result = "";
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const sum = Number(a.at(-1 - i) ?? 0) + Number(b.at(-1 - i) ?? 0) + carry;
    result = `${sum % 10}${result}`;
    carry = Math.floor(sum / 10);
  }
  return `${carry || ""}${result}`.replace(/^0+(?=\d)/, "");
}

/** Resta magnitudes decimales enteras con a >= b. */
function subtractMagnitude(a: string, b: string): string {
  let borrow = 0;
  let result = "";
  for (let i = 0; i < a.length; i += 1) {
    let digit = Number(a.at(-1 - i)) - Number(b.at(-1 - i) ?? 0) - borrow;
    borrow = digit < 0 ? 1 : 0;
    if (borrow) digit += 10;
    result = `${digit}${result}`;
  }
  return result.replace(/^0+(?=\d)/, "");
}

function compareDecimal(left: DecimalValue, right: DecimalValue): number {
  const scale = Math.max(left.scale, right.scale);
  if (left.negative !== right.negative) return left.negative ? -1 : 1;
  const magnitude = compareMagnitude(scaledDigits(left, scale), scaledDigits(right, scale));
  return left.negative ? -magnitude : magnitude;
}

function decimalEquals(left: unknown, right: unknown): boolean {
  const a = decimal(left);
  const b = decimal(right);
  return a !== null && b !== null && compareDecimal(a, b) === 0;
}

function isNonNegativeDecimal(value: unknown): boolean {
  const parsed = decimal(value);
  return parsed !== null && !parsed.negative;
}

function decimalSumEquals(values: unknown[], expected: unknown): boolean {
  const parsed = values.map(decimal);
  const target = decimal(expected);
  if (target === null || parsed.some((value) => value === null)) return false;
  const numbers = parsed as DecimalValue[];
  const scale = Math.max(target.scale, ...numbers.map((value) => value.scale));
  let sum = { negative: false, digits: "0" };
  for (const value of numbers) {
    const digits = scaledDigits(value, scale);
    if (sum.negative === value.negative) {
      sum = { negative: sum.negative, digits: addMagnitude(sum.digits, digits) };
    } else {
      const order = compareMagnitude(sum.digits, digits);
      sum =
        order >= 0
          ? { negative: sum.negative, digits: subtractMagnitude(sum.digits, digits) }
          : { negative: value.negative, digits: subtractMagnitude(digits, sum.digits) };
      if (/^0+$/.test(sum.digits)) sum.negative = false;
    }
  }
  return sum.negative === target.negative && sum.digits === scaledDigits(target, scale);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCalendarDate(yearText: string, monthText: string, dayText: string): boolean {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1]!;
}

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match !== null && isCalendarDate(match[1]!, match[2]!, match[3]!);
}

function isRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  if (!zone) return false;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!isCalendarDate(yearText!, monthText!, dayText!) || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  if (zone !== "Z") {
    const zoneHour = Number(zone.slice(1, 3));
    const zoneMinute = Number(zone.slice(4, 6));
    if (zoneHour > 23 || zoneMinute > 59) return false;
  }
  return true;
}

const PAYABLE_CURRENCY_STATUSES = [
  "verified",
  "functional_only",
  "unknown",
  "conflict",
  "unsupported",
] as const;

function isCurrencyEvidence(value: Record<string, unknown>): boolean {
  const status = value.currency_status;
  const currency = value.currency;
  if (!PAYABLE_CURRENCY_STATUSES.includes(status as (typeof PAYABLE_CURRENCY_STATUSES)[number])) {
    return false;
  }
  return status === "verified"
    ? typeof currency === "string" && /^[A-Z]{3}$/.test(currency)
    : currency === null;
}

/** `true` si el registro declara su importe desconocido por cuarentena. */
function isQuarantined(value: Record<string, unknown>): boolean {
  return value.amount_unknown_reason === AMOUNT_UNKNOWN_QUARANTINE;
}

/** Motivo ausente, `null` o el de cuarentena. Cualquier otro valor es un contrato roto. */
function isUnknownReason(value: Record<string, unknown>): boolean {
  const reason = value.amount_unknown_reason;
  return reason === undefined || reason === null || reason === AMOUNT_UNKNOWN_QUARANTINE;
}

/**
 * Un importe conocido (string-decimal) o, sólo con el motivo de cuarentena, `null`. Un `null`
 * sin motivo, o un importe junto al motivo, se rechazan: "desconocido" no es cero ni se mezcla
 * con una cifra.
 */
function isAmountOrQuarantined(owner: Record<string, unknown>, amount: unknown): boolean {
  if (!isUnknownReason(owner)) return false;
  return isQuarantined(owner) ? amount === null : decimal(amount) !== null;
}

function isCurrencyTotals(value: unknown): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return false;
  const currencies = value.map((entry) => (isRecord(entry) ? entry.currency : null));
  return (
    new Set(currencies).size === currencies.length &&
    value.every(
      (entry) =>
        isRecord(entry) && isCurrencyEvidence(entry) && isAmountOrQuarantined(entry, entry.amount),
    )
  );
}

function isAggregate(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const complete = value.complete;
  const excluded = value.excluded_by_currency;
  // Cuarentena (#907): el universo del bucket es desconocido. No hay "parte conocida", ni
  // monto completo, ni puede declararse completo.
  if (isQuarantined(value)) {
    return (
      value.amount_clp === null &&
      value.known_amount_clp === null &&
      complete === false &&
      isCount(value.count) &&
      isCount(value.unknown_due_date_count) &&
      isCurrencyTotals(excluded)
    );
  }
  const valid =
    isUnknownReason(value) &&
    (value.amount_clp === null || decimal(value.amount_clp) !== null) &&
    decimal(value.known_amount_clp) !== null &&
    typeof value.complete === "boolean" &&
    isCount(value.count) &&
    isCount(value.unknown_due_date_count) &&
    isCurrencyTotals(excluded);
  if (!valid) return false;
  if (complete === false) return value.amount_clp === null;
  return (
    value.amount_clp !== null &&
    value.unknown_due_date_count === 0 &&
    excluded.length === 0 &&
    decimalEquals(value.amount_clp, value.known_amount_clp)
  );
}

/** Los buckets ejecutables de vencido/crítico contienen sólo obligaciones positivas. */
function isNonNegativeAggregate(value: unknown): value is Record<string, unknown> {
  return (
    isAggregate(value) &&
    (isQuarantined(value) || isNonNegativeDecimal(value.known_amount_clp)) &&
    (value.amount_clp === null || isNonNegativeDecimal(value.amount_clp)) &&
    (value.excluded_by_currency as Array<Record<string, unknown>>).every(
      (bucket) => isQuarantined(bucket) || isNonNegativeDecimal(bucket.amount),
    )
  );
}

function isEnumBuckets(
  value: unknown,
  key: "category" | "criticality" | "state",
  expected: readonly string[],
  aggregate = false,
): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  const names = value.map((entry) => (isRecord(entry) ? entry[key] : null));
  return (
    new Set(names).size === expected.length &&
    expected.every((name) => names.includes(name)) &&
    value.every(
      (entry) => isRecord(entry) && isCount(entry.count) && (!aggregate || isAggregate(entry)),
    )
  );
}

/** `by_category` de nivel superior sólo trae las categorías con documentos (qavante-api
 *  `payables_repo`); a diferencia de las facetas de filtro, no publica ceros. */
function isPresentCategoryBuckets(value: unknown): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return false;
  const names = value.map((entry) => (isRecord(entry) ? entry.category : null));
  return (
    new Set(names).size === names.length &&
    names.every((name) => CATEGORIES.includes(name as (typeof CATEGORIES)[number])) &&
    value.every((entry) => isRecord(entry) && isCount(entry.count) && isAggregate(entry))
  );
}

function isCashProjection(value: Record<string, unknown>): boolean {
  const publicable = value.cash_projection_publicable_14d;
  if (typeof publicable !== "boolean") return false;
  const projected = decimal(value.projected_cash_14d);
  const minimum = decimal(value.min_14d);
  const gap = decimal(value.cash_gap_amount_14d);

  if (!publicable) {
    return value.min_14d === null && value.cash_gap_amount_14d === null && value.has_gap === null;
  }
  if (
    projected === null ||
    minimum === null ||
    gap === null ||
    typeof value.has_gap !== "boolean"
  ) {
    return false;
  }
  if (compareDecimal(minimum, projected) > 0) return false;
  const hasGap = minimum.negative;
  const expectedGap: DecimalValue = hasGap
    ? { negative: false, digits: minimum.digits, scale: minimum.scale }
    : { negative: false, digits: "0", scale: 0 };
  return value.has_gap === hasGap && compareDecimal(gap, expectedGap) === 0;
}

function isPayrollCoverage(value: unknown): boolean {
  if (!isRecord(value) || typeof value.complete !== "boolean" || !Array.isArray(value.sources)) {
    return false;
  }
  if (value.sources.length !== 2) return false;

  const sources = value.sources;
  const sourceNames = sources.map((source) => (isRecord(source) ? source.source : null));
  if (
    new Set(sourceNames).size !== 2 ||
    !sourceNames.includes("buk") ||
    !sourceNames.includes("previred")
  ) {
    return false;
  }

  const validSources = sources.every(
    (source) =>
      isRecord(source) &&
      (source.source === "buk" || source.source === "previred") &&
      typeof source.status === "string" &&
      source.status.trim().length > 0 &&
      (source.last_success_at === null || isRfc3339DateTime(source.last_success_at)) &&
      typeof source.covered === "boolean" &&
      typeof source.freshness_confirmed === "boolean",
  );
  if (!validSources) return false;

  return (
    value.complete === false ||
    sources.every(
      (source) =>
        isRecord(source) && source.covered === true && source.freshness_confirmed === true,
    )
  );
}

const CATEGORIES = ["supplier", "tax", "payroll", "rent", "debt", "leasing", "other"] as const;
const CRITICALITIES = ["high", "medium", "low"] as const;
/** Los ítems además pueden venir `unknown`; las facetas de filtro sólo filtran por las tres. */
const ITEM_CRITICALITIES = [...CRITICALITIES, "unknown"] as const;
export type PayableCriticality = (typeof ITEM_CRITICALITIES)[number];
const STATES = ["open", "partially_paid"] as const;

function isFilterMetadata(value: unknown, itemsTotal: unknown): boolean {
  return (
    isRecord(value) &&
    isCount(value.unfiltered_items_total) &&
    isCount(value.matched_items_total) &&
    value.matched_items_total === itemsTotal &&
    value.unfiltered_items_total >= value.matched_items_total &&
    isEnumBuckets(value.by_category, "category", CATEGORIES) &&
    isEnumBuckets(value.by_criticality, "criticality", CRITICALITIES) &&
    isEnumBuckets(value.by_state, "state", STATES)
  );
}

function isPayableItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.label === "string" &&
    value.label.trim().length > 0 &&
    CATEGORIES.includes(value.category as (typeof CATEGORIES)[number]) &&
    isIsoCalendarDate(value.due_date) &&
    isAmountOrQuarantined(value, value.amount) &&
    ITEM_CRITICALITIES.includes(value.criticality as PayableCriticality) &&
    typeof value.source === "string" &&
    value.source.trim().length > 0 &&
    isCurrencyEvidence(value) &&
    (value.amount_clp === undefined ||
      value.amount_clp === null ||
      (!isQuarantined(value) && decimal(value.amount_clp) !== null)) &&
    typeof value.reclamado === "boolean"
  );
}

function isNextPayroll(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      value.category === "payroll" &&
      typeof value.label === "string" &&
      value.label.trim().length > 0 &&
      isIsoCalendarDate(value.due_date) &&
      isAmountOrQuarantined(value, value.amount) &&
      isCurrencyEvidence(value) &&
      (value.amount_clp === null ||
        (!isQuarantined(value) && decimal(value.amount_clp) !== null)) &&
      typeof value.is_overdue === "boolean")
  );
}

/**
 * Totales de Pagar. Con cuarentena AP viva (qavante-api#907) TODOS son desconocidos: `total`,
 * tramos y sin-fecha vienen `null`, los resúmenes también, y la curva no se publica (la curva
 * resta esos mismos payables). Nada de eso es un piso ni una suma parcial. Sin cuarentena rigen
 * las invariantes de siempre.
 */
function hasCoherentTotals(value: Record<string, unknown>): boolean {
  if (!isUnknownReason(value)) return false;
  const summaries: unknown[] = [
    value.non_postponable_or_overdue_14d,
    value.overdue_summary,
    value.undated_summary,
    value.credits,
    ...(Array.isArray(value.by_category) ? value.by_category : []),
  ];
  if (isQuarantined(value)) {
    return (
      value.total === null &&
      value.due_7d === null &&
      value.due_14d === null &&
      value.due_30d === null &&
      value.undated_amount === null &&
      value.cash_projection_publicable_14d === false &&
      (value.projected_cash_14d === undefined || value.projected_cash_14d === null) &&
      (value.covers_critical === undefined || value.covers_critical === null) &&
      summaries.every((summary) => isRecord(summary) && isQuarantined(summary))
    );
  }
  const byCategory = value.by_category as Array<Record<string, unknown>>;
  const undatedSummary = value.undated_summary as Record<string, unknown>;
  return (
    summaries.every((summary) => isRecord(summary) && !isQuarantined(summary)) &&
    decimalSumEquals(
      byCategory.map((entry) => entry.known_amount_clp),
      value.total,
    ) &&
    decimal(value.total) !== null &&
    isNonNegativeDecimal(value.due_7d) &&
    isNonNegativeDecimal(value.due_14d) &&
    isNonNegativeDecimal(value.due_30d) &&
    compareDecimal(decimal(value.due_7d)!, decimal(value.due_14d)!) <= 0 &&
    compareDecimal(decimal(value.due_14d)!, decimal(value.due_30d)!) <= 0 &&
    isNonNegativeDecimal(value.undated_amount) &&
    decimalEquals(undatedSummary.known_amount_clp, value.undated_amount)
  );
}

/**
 * Moneda de la curva de 14 días (#370 v1, qavante-api#905). Una ISO-4217 verificada, o `null`
 * cuando ni la proyección ni la empresa la acreditan. `null` es abstención: sólo es coherente si
 * la curva tampoco publica cifras. Una cifra con unidad `null` se rechaza, y nunca se completa
 * con CLP.
 */
function isProjectedCashCurrency(value: Record<string, unknown>): boolean {
  const currency = value.projected_cash_currency;
  if (typeof currency === "string") return /^[A-Z]{3}$/.test(currency);
  return (
    currency === null &&
    value.cash_projection_publicable_14d === false &&
    (value.projected_cash_14d === undefined || value.projected_cash_14d === null)
  );
}

function hasSupportedCoverage(value: Record<string, unknown>): boolean {
  const covers = value.covers_critical;
  if (covers === undefined || covers === null) return true;
  if (typeof covers !== "boolean") return false;
  return (
    value.cash_projection_publicable_14d === true &&
    value.projected_cash_currency === "CLP" &&
    value.data_state === "available" &&
    value.undated_count === 0 &&
    isRecord(value.non_postponable_or_overdue_14d) &&
    value.non_postponable_or_overdue_14d.complete === true &&
    covers === !value.has_gap
  );
}

/** Boundary runtime del contrato D02. Un API legacy nunca habilita KPI ni paginación parcial. */
export function assertAccountsPayableResponse(value: unknown): D02AccountsPayableResponse {
  if (!isRecord(value)) throw incompatibleAccountsPayable(value);
  const metadata = value.filter_metadata;
  const payroll = value.payroll_coverage;
  const nextPayroll = value.next_payroll;
  const cursor = value.next_cursor;
  const items = value.items;
  const valid =
    isIsoCalendarDate(value.as_of) &&
    typeof value.snapshot_id === "string" &&
    /^[0-9a-f]{64}$/.test(value.snapshot_id) &&
    isCount(value.items_total) &&
    isCount(value.limit) &&
    value.limit > 0 &&
    typeof value.has_more === "boolean" &&
    (typeof cursor === "string" || cursor === null) &&
    value.has_more === (cursor !== null) &&
    isNonNegativeAggregate(value.overdue_summary) &&
    isNonNegativeAggregate(value.non_postponable_or_overdue_14d) &&
    isAggregate(value.undated_summary) &&
    isAggregate(value.credits) &&
    isPresentCategoryBuckets(value.by_category) &&
    hasCoherentTotals(value) &&
    isCount(value.undated_count) &&
    value.undated_summary.count === value.undated_count &&
    (value.zero_balance_count === null || isCount(value.zero_balance_count)) &&
    isCurrencyTotals(value.excluded_from_total_by_currency) &&
    (value.total_by_currency === undefined || isCurrencyTotals(value.total_by_currency)) &&
    isFilterMetadata(metadata, value.items_total) &&
    isPayrollCoverage(payroll) &&
    isNextPayroll(nextPayroll) &&
    (value.data_state === "available" ||
      value.data_state === "partial" ||
      value.data_state === "estimated") &&
    typeof value.confidence === "string" &&
    ["high", "medium", "low"].includes(value.confidence) &&
    isRfc3339DateTime(value.generated_at) &&
    isProjectedCashCurrency(value) &&
    (value.projected_cash_14d === undefined ||
      value.projected_cash_14d === null ||
      decimal(value.projected_cash_14d) !== null) &&
    isCashProjection(value) &&
    hasSupportedCoverage(value) &&
    (value.missing_sources === undefined ||
      (Array.isArray(value.missing_sources) &&
        value.missing_sources.every((source) => typeof source === "string"))) &&
    (items === undefined ||
      (Array.isArray(items) &&
        items.length <= value.limit &&
        items.length <= value.items_total &&
        items.every(isPayableItem)));
  if (!valid) throw incompatibleAccountsPayable(value);
  return value as D02AccountsPayableResponse;
}

function incompatibleAccountsPayable(detail: unknown): ApiError {
  return new ApiError(
    "El servicio de pagos no publicó el contrato completo requerido por esta pantalla.",
    502,
    "incompatible_accounts_payable_contract",
    detail,
  );
}

export function normalizeAccountsPayableQuery(
  query: AccountsPayableQuery = {},
): AccountsPayableQuery {
  const search = query.search?.trim();
  return {
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.limit === undefined ? {} : { limit: query.limit }),
    ...(query.category ? { category: query.category } : {}),
    ...(query.criticality ? { criticality: query.criticality } : {}),
    ...(query.due_from ? { due_from: query.due_from } : {}),
    ...(query.due_to ? { due_to: query.due_to } : {}),
    ...(query.state ? { state: query.state } : {}),
    ...(search ? { search } : {}),
  };
}

export function accountsPayablePath(query: AccountsPayableQuery = {}): string {
  const normalized = normalizeAccountsPayableQuery(query);
  const params = new URLSearchParams();
  for (const key of [
    "cursor",
    "limit",
    "category",
    "criticality",
    "due_from",
    "due_to",
    "state",
    "search",
  ] as const) {
    const value = normalized[key];
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const suffix = params.toString();
  return `/api/treasury/accounts-payable${suffix ? `?${suffix}` : ""}`;
}

/** `GET /api/treasury/accounts-payable` — snapshot paginado D02. Sin retry. */
export function accountsPayableQueryOptions(query: AccountsPayableQuery = {}) {
  return {
    queryKey: pagosKeys.accountsPayable(query),
    queryFn: async () =>
      assertAccountsPayableResponse(await api.get<unknown>(accountsPayablePath(query))),
    staleTime: 30_000,
    retry: false as const,
  };
}

export function useAccountsPayable(query: AccountsPayableQuery = {}) {
  return useQuery(accountsPayableQueryOptions(query));
}

/** `GET /api/treasury/accounts-payable/anomalies` — pares UUID read-only, sin el tope de 100
 * del listado. Si falla, el consumidor debe declarar que la señal de duplicados no llegó; nunca
 * concluir que no hay anomalías. */
export function usePayableDuplicateAnomalies() {
  return useQuery({
    queryKey: pagosKeys.payableDuplicateAnomalies(),
    queryFn: () =>
      api.get<PayableDuplicateAnomaliesResponse>("/api/treasury/accounts-payable/anomalies"),
    staleTime: 30_000,
    retry: false,
  });
}
