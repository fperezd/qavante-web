import { formatMoney } from "@/lib/formatters/clp";
import { concordar, formatCount } from "@/lib/formatters/count";
import { formatDateLike, formatDateTimeLike } from "@/lib/formatters/date";
import { formatPct } from "@/lib/formatters/pct";
import type { components } from "@/lib/api/types";

export type FinancingOverviewContract = components["schemas"]["FinancingOverviewResponse"];
export type FinancingDebtContract = components["schemas"]["FinancingOverviewDebtRead"];
export type FinancingAlternativeContract = components["schemas"]["FinancingAlternativeRead"];
type FinancialDimensionsContract = components["schemas"]["FinancialDimensionsRead"];
type GeneratedFinancingEvaluation =
  components["schemas"]["WorkingCapitalRefinancingEvaluationResponse"];
/** Contrato generado completo. La vista necesita estados, motivos, combinaciones y tradeoffs;
 * reducirlo a un Pick permite silenciar una abstención material sin error de tipos. */
export type FinancingEvaluationContract = GeneratedFinancingEvaluation;

export interface FinancingV13Model {
  state: FinancingOverviewContract["state"];
  currency: string;
  cutOffLabel: string;
  freshnessLabel: string;
  evidenceLabel: string;
  coverageLabel: string;
  reasons: string[];
  principal: number | null;
  remainingCost: number | null;
  comparableRatePct: number | null;
  availableCapacity: number | null;
  debts: FinancingDebtView[];
  alternatives: FinancingAlternativeView[];
  evaluation: FinancingEvaluationView | null;
  combinations: FinancingCombinationView[];
  tradeoffs: FinancingTradeoffView[];
}

export interface FinancingDebtView {
  id: string;
  label: string;
  detail: string;
  principal: number;
  remainingCost: number | null;
  nextPayment: number | null;
  nextPaymentDateLabel: string | null;
  maturityLabel: string | null;
  rateLabel: string | null;
}

export interface FinancingAlternativeView {
  id: string;
  label: string;
  stateLabel: string;
  eligibilityLabel: string;
  isNoAction: boolean;
  cost: number | null;
  netLiquidity: number | null;
  durationDays: number | null;
  reasons: string[];
}

export interface FinancingEvaluationView {
  stateLabel: string;
  reasons: string[];
  scopes: Array<{
    label: string;
    stateLabel: string;
    reasons: string[];
  }>;
  excludedCombinationCount: number;
  excludedCombinationReasons: string[];
  combinationsTruncated: boolean;
  maxCombinations: number | null;
}

export interface FinancingCombinationView {
  id: string;
  componentLabels: string[];
  appliedRule: string;
  policyRef: string;
  cost: number | null;
  netLiquidity: number | null;
  maximumDebtService: number | null;
  durationDays: number | null;
  paymentConcentration: number | null;
  guarantees: string[] | null;
}

export interface FinancingDimensionsView {
  totalFinancialCost: number | null;
  netLiquidity: number | null;
  maximumDebtService: number | null;
  durationDays: number | null;
  paymentConcentration: number | null;
  guarantees: string[] | null;
}

export interface FinancingScheduledPaymentView {
  dueDateLabel: string;
  amount: number | null;
}

export interface FinancingTradeoffView {
  id: string;
  closeDateLabel: string;
  current: FinancingDimensionsView;
  proposed: FinancingDimensionsView;
  totalCostDelta: number | null;
  maximumServiceDelta: number | null;
  durationDeltaDays: number;
  paymentConcentrationDelta: number | null;
  currentSchedule: FinancingScheduledPaymentView[];
  proposedSchedule: FinancingScheduledPaymentView[];
  currentPaymentCount: number;
  proposedPaymentCount: number;
  guaranteesAdded: string[];
  guaranteesRemoved: string[];
}

const INSTRUMENT_LABELS: Record<string, string> = {
  loan: "Crédito",
  credit_line: "Línea de crédito",
  factoring: "Factoring",
  leasing: "Leasing",
  refinancing: "Refinanciamiento",
  working_capital: "Capital de trabajo",
};

const REASON_LABELS: Record<string, string> = {
  ambiguous_refinancing_snapshot: "Hay más de un corte de deuda posible para la misma fecha.",
  comparable_cost_evidence_required: "Falta evidencia para calcular un costo comparable.",
  counterparty_not_available: "La contraparte no está identificada en la fuente.",
  debt_maturity_before_as_of: "La deuda aparece vencida antes de la fecha de corte.",
  debt_schedule_contains_past_payment: "El calendario incluye una cuota anterior al corte.",
  debt_schedule_exceeds_maturity: "El calendario contiene cuotas posteriores al vencimiento.",
  debt_schedule_not_strictly_ordered: "El calendario de cuotas no tiene un orden verificable.",
  future_as_of: "La fecha de corte solicitada está en el futuro.",
  future_refinancing_context: "La evidencia de deuda fue registrada después del corte.",
  instrument_type_not_available: "El tipo de instrumento no está identificado en la fuente.",
  legacy_debt_scope_not_reproducible:
    "La deuda histórica no tiene una entidad legal y moneda reproducibles.",
  legal_entity_not_found_in_tenant: "La entidad legal no pertenece a la empresa seleccionada.",
  "missing_debt_term:rate_type": "La fuente no informa el tipo de tasa.",
  "missing_debt_term:repayment_schedule": "La fuente no informa un calendario de cuotas.",
  refinancing_context_schema_version_mismatch:
    "La evidencia disponible no es compatible con esta evaluación de financiamiento.",
  refinancing_lineage_mismatch: "La evidencia de deuda no conserva una trazabilidad verificable.",
  refinancing_source_freshness_not_verified:
    "La vigencia de la fuente de deuda no está verificada.",
  refinancing_source_integrity_not_verified:
    "La integridad de la fuente de deuda no está verificada.",
  remaining_financial_cost_not_available: "El costo financiero restante no está disponible.",
  repayment_schedule_not_available: "El calendario de cuotas no está disponible.",
  verified_credit_capacity_required: "Falta una capacidad de crédito verificada.",
  verified_scoped_debt_required: "Falta deuda verificada para esta entidad legal y moneda.",
  verified_offer_required: "Falta una oferta verificada para comparar esta alternativa.",
  no_cash_gap: "El corte no muestra una brecha de caja que justifique financiarse.",
  structural_need_does_not_authorize_debt:
    "La necesidad parece estructural y no autoriza recomendar deuda por sí sola.",
  max_combinations_reached: "La evaluación alcanzó el máximo de combinaciones permitido.",
};

export function financingV13Model(
  overview: FinancingOverviewContract,
  evaluation?: FinancingEvaluationContract | null,
): FinancingV13Model {
  const currency = overview.scope.currency.toUpperCase();
  const sourceRefCount = overview.source_refs?.length ?? 0;
  const debts = (overview.debts ?? []).flatMap((debt) => {
    const principal = decimalNoNegativo(debt.outstanding_principal);
    if (principal === null) return [];
    const type = labelInstrument(debt.instrument_type);
    return [
      {
        id: debt.debt_ref,
        label: debt.counterparty ? `${type} · ${debt.counterparty}` : type,
        detail: debt.reason_codes?.length
          ? `Cobertura parcial · ${debt.reason_codes.map(reasonLabel).join(" · ")}`
          : "Dato respaldado por el corte financiero",
        principal,
        remainingCost: decimalNoNegativo(debt.remaining_financial_cost),
        nextPayment: decimalNoNegativo(debt.next_payment_amount),
        nextPaymentDateLabel: debt.next_payment_date
          ? formatDateLike(debt.next_payment_date)
          : null,
        maturityLabel: debt.maturity_date ? formatDateLike(debt.maturity_date) : null,
        rateLabel: rateLabel(debt.contract_rate_type, debt.contract_rate_value),
      },
    ];
  });

  const alternatives = evaluation
    ? [...evaluation.working_capital.alternatives, ...evaluation.refinancing.alternatives].map(
        alternativeView,
      )
    : [];
  const alternativesByCode = new Map(
    alternatives.map((alternative) => [alternative.id, alternative.label]),
  );
  const combinations = (evaluation?.combinations.combinations ?? []).map((combination) => ({
    id: combination.component_codes.join("+"),
    componentLabels: combination.component_codes.map(
      (code) => alternativesByCode.get(code) ?? "Alternativa financiera",
    ),
    appliedRule: combination.applied_rule,
    policyRef: combination.policy_ref,
    cost: decimalNoNegativo(combination.dimensions.total_financial_cost),
    netLiquidity: decimal(combination.dimensions.net_liquidity),
    maximumDebtService: decimalNoNegativo(combination.dimensions.maximum_debt_service),
    durationDays:
      typeof combination.dimensions.duration_days === "number" &&
      combination.dimensions.duration_days >= 0
        ? combination.dimensions.duration_days
        : null,
    paymentConcentration: decimalNoNegativo(combination.dimensions.payment_concentration),
    guarantees: combination.dimensions.guarantees ?? null,
  }));
  const tradeoffs = (evaluation?.refinancing.tradeoffs ?? []).map((tradeoff) => ({
    id: `${tradeoff.old_obligation_ref}:${tradeoff.new_obligation_ref}`,
    closeDateLabel: formatDateLike(tradeoff.close_effective_date),
    current: financialDimensionsView(tradeoff.current),
    proposed: financialDimensionsView(tradeoff.proposed),
    totalCostDelta: decimal(tradeoff.total_cost_delta),
    maximumServiceDelta: decimal(tradeoff.maximum_service_delta),
    durationDeltaDays: tradeoff.duration_delta_days,
    paymentConcentrationDelta: decimal(tradeoff.payment_concentration_delta),
    currentSchedule: tradeoff.current_schedule.map((payment) => ({
      dueDateLabel: formatDateLike(payment.due_date),
      amount: decimalNoNegativo(payment.amount),
    })),
    proposedSchedule: tradeoff.new_schedule.map((payment) => ({
      dueDateLabel: formatDateLike(payment.due_date),
      amount: decimalNoNegativo(payment.amount),
    })),
    currentPaymentCount: tradeoff.current_schedule.length,
    proposedPaymentCount: tradeoff.new_schedule.length,
    guaranteesAdded: tradeoff.guarantees_added ?? [],
    guaranteesRemoved: tradeoff.guarantees_removed ?? [],
  }));
  const evaluationView = evaluation
    ? {
        stateLabel: evaluationStateLabel(evaluation.state),
        reasons: (evaluation.abstain_reasons ?? []).map(reasonLabel),
        scopes: [
          {
            label: "Capital de trabajo",
            stateLabel: evaluationStateLabel(evaluation.working_capital.state),
            reasons: (evaluation.working_capital.reasons ?? []).map(reasonLabel),
          },
          {
            label: "Refinanciamiento",
            stateLabel: evaluationStateLabel(evaluation.refinancing.state),
            reasons: (evaluation.refinancing.reasons ?? []).map(reasonLabel),
          },
        ],
        excludedCombinationCount: evaluation.combinations.excluded?.length ?? 0,
        excludedCombinationReasons: [
          ...(evaluation.combinations.reason_codes ?? []),
          ...(evaluation.combinations.excluded ?? []).map((item) => item.reason_code),
        ]
          .filter((reason, index, values) => values.indexOf(reason) === index)
          .map(reasonLabel),
        combinationsTruncated: evaluation.combinations.truncated,
        maxCombinations: evaluation.combinations.max_combinations ?? null,
      }
    : null;

  return {
    state: overview.state,
    currency,
    cutOffLabel: formatDateTimeLike(overview.scope.as_of),
    freshnessLabel:
      overview.freshness.status === "fresh" && overview.freshness.observed_at
        ? `Datos observados ${formatDateTimeLike(overview.freshness.observed_at)}`
        : "Frescura sin dato",
    evidenceLabel:
      sourceRefCount > 0
        ? `${formatCount(sourceRefCount)} ${concordar(
            sourceRefCount,
            "referencia de fuente",
            "referencias de fuente",
          )}`
        : "Fuente sin dato",
    coverageLabel:
      overview.debt_coverage === "complete"
        ? "Cobertura completa"
        : overview.debt_coverage === "partial"
          ? "Cobertura parcial"
          : "Cobertura sin dato",
    reasons: (overview.reason_codes ?? []).map(reasonLabel),
    principal: decimalNoNegativo(overview.outstanding_principal),
    remainingCost: decimalNoNegativo(overview.remaining_financial_cost),
    comparableRatePct: ratioAPorcentaje(overview.comparable_cost_rate),
    availableCapacity: decimalNoNegativo(overview.verified_available_capacity),
    debts,
    alternatives,
    evaluation: evaluationView,
    combinations,
    tradeoffs,
  };
}

export function financingMoney(value: number, currency: string): string {
  return formatMoney(value, currency);
}

export function financingRate(valuePct: number): string {
  return formatPct(valuePct);
}

function alternativeView(item: FinancingAlternativeContract): FinancingAlternativeView {
  return {
    id: item.code,
    label: item.is_no_action ? "No financiar" : labelInstrument(item.instrument_type),
    stateLabel:
      item.state === "executable"
        ? "Verificada · sólo lectura"
        : item.state === "comparable"
          ? "Comparable"
          : item.state === "indicative"
            ? "Referencia indicativa"
            : "No evaluable",
    eligibilityLabel: eligibilityStateLabel(item.eligibility_state),
    isNoAction: item.is_no_action,
    cost: decimalNoNegativo(item.dimensions.total_financial_cost),
    netLiquidity: decimal(item.dimensions.net_liquidity),
    durationDays:
      typeof item.dimensions.duration_days === "number" && item.dimensions.duration_days >= 0
        ? item.dimensions.duration_days
        : null,
    reasons: (item.reason_codes ?? []).map(reasonLabel),
  };
}

function labelInstrument(value: string | null | undefined): string {
  if (!value) return "Instrumento financiero";
  return INSTRUMENT_LABELS[value] ?? "Instrumento financiero";
}

function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? "La fuente informó una limitación todavía no identificada.";
}

function eligibilityStateLabel(state: FinancingAlternativeContract["eligibility_state"]): string {
  if (state === "eligible") return "Elegible";
  if (state === "potentially_eligible") return "Elegibilidad por verificar";
  if (state === "ineligible") return "No elegible";
  return "Elegibilidad no evaluable";
}

function evaluationStateLabel(state: "ready" | "observed_only" | "abstained"): string {
  if (state === "ready") return "Evaluable";
  if (state === "observed_only") return "Sólo observado";
  return "No evaluable";
}

function financialDimensionsView(dimensions: FinancialDimensionsContract): FinancingDimensionsView {
  return {
    totalFinancialCost: decimalNoNegativo(dimensions.total_financial_cost),
    netLiquidity: decimal(dimensions.net_liquidity),
    maximumDebtService: decimalNoNegativo(dimensions.maximum_debt_service),
    durationDays:
      typeof dimensions.duration_days === "number" && dimensions.duration_days >= 0
        ? dimensions.duration_days
        : null,
    paymentConcentration: decimalNoNegativo(dimensions.payment_concentration),
    guarantees: dimensions.guarantees ?? null,
  };
}

function rateLabel(type: string | null | undefined, raw: string | null | undefined): string | null {
  const pct = ratioAPorcentaje(raw);
  if (pct === null) return null;
  const rateTypeLabels: Record<string, string> = {
    annual_nominal: "nominal anual",
    fixed: "fija",
    fixed_annual: "fija anual",
    fixed_monthly: "fija mensual",
    monthly: "mensual",
  };
  const knownType = type ? rateTypeLabels[type] : undefined;
  const kind = knownType ? ` · ${knownType}` : "";
  return `${formatPct(pct)}${kind}`;
}

function ratioAPorcentaje(raw: string | null | undefined): number | null {
  const ratio = decimalNoNegativo(raw);
  return ratio === null ? null : ratio * 100;
}

function decimalNoNegativo(raw: string | null | undefined): number | null {
  const value = decimal(raw);
  return value !== null && value >= 0 ? value : null;
}

function decimal(raw: string | null | undefined): number | null {
  if (typeof raw !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
