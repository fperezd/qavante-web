import type {
  FxEvaluationRead,
  FxExposureRead,
  InvestmentEvaluationRead,
  InvestableSurplusRead,
  OutcomeValueRead,
} from "@/lib/api/financial-decision-readers";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { formatMoney } from "@/lib/formatters/clp";

export type OutcomeTrackingItem = NonNullable<OutcomeValueRead["outcomes"]>[number];

export type ReaderResponse =
  | FxExposureRead
  | FxEvaluationRead
  | InvestableSurplusRead
  | InvestmentEvaluationRead
  | OutcomeValueRead;

export type ReaderCollection = "exposures" | "evaluations" | "products" | "outcomes";

export interface OutcomeFinancialFieldView {
  label: string;
  value: string;
}

export interface OutcomeTraceGroupView {
  key: "assessment" | "value_ledger" | "projection_error" | "quote_realization";
  label: string;
  evidenceRefs: string[];
  lineageRefs: string[];
}

export interface OutcomeDecisionView {
  id: string;
  decisionRef: string;
  alternative: string;
  operationalState: string;
  assessmentState: OutcomeTrackingItem["assessment"]["state"];
  assessmentFields: OutcomeFinancialFieldView[];
  assessmentReasons: string[];
  valueLedgerState: OutcomeTrackingItem["value_ledger"]["state"];
  attributedValue: string;
  ledgerFields: OutcomeFinancialFieldView[];
  attributionLabel: string | null;
  confidence: OutcomeTrackingItem["assessment"]["confidence"];
  projectionFields: OutcomeFinancialFieldView[];
  quoteFields: OutcomeFinancialFieldView[];
  traceGroups: OutcomeTraceGroupView[];
  limitations: string[];
}

export function itemCount(
  data: ReaderResponse | undefined,
  collection: ReaderCollection,
): number | null {
  if (!data) return null;
  switch (collection) {
    case "exposures":
      return "exposures" in data ? (data.exposures?.length ?? 0) : null;
    case "evaluations":
      return "evaluations" in data ? (data.evaluations?.length ?? 0) : null;
    case "products":
      return "products" in data ? (data.products?.length ?? 0) : null;
    case "outcomes":
      return "outcomes" in data ? (data.outcomes?.length ?? 0) : null;
  }
}

export function itemSummary(
  count: number | null,
  itemLabel: string,
  itemLabelPlural: string,
): string {
  if (count === null) return "Snapshot publicado sin detalle contable en este contrato.";
  return `${count} ${count === 1 ? itemLabel : itemLabelPlural} publicada${count === 1 ? "" : "s"}; no representa un monto.`;
}

/**
 * F9 publica hechos operativos y sus límites de medición, no un resultado financiero.
 * Keep both reason lists visible: collapsing either one would make an abstention look like a
 * successful value calculation.
 */
export function outcomeTrackingSummary(outcome: OutcomeTrackingItem): string[] {
  const task = outcome.task_summary;
  const taskSummary = task
    ? `Tareas: ${task.pending} pendientes, ${task.in_progress} en curso, ${task.completed} completadas y ${task.cancelled} canceladas.`
    : "Tareas: el snapshot no publicó un resumen operativo.";

  const common = [`Estado operativo: ${outcome.operational_state}.`, taskSummary];

  const measurement = outcome.economic_measurement;
  if (measurement.state === "partial") {
    return [
      ...common,
      `Medición económica parcial observada: ${measurement.metric_code} (${measurement.metric_basis}) entre ${measurement.period_start} y ${measurement.period_end}.`,
      `Límites de medición parcial: ${measurement.reasons.join(", ") || "sin motivo publicado"}.`,
      `Hashes de evidencia: ${measurement.evidence_hashes.join(", ") || "sin hash publicado"}.`,
      `Evidencia de medición: ${measurement.source_refs.join(", ")}; linaje: ${measurement.lineage_refs.join(", ")}.`,
      `Value Ledger no evaluable: ${(outcome.value_ledger.reasons ?? []).join(", ") || "sin motivo publicado"}.`,
    ];
  }

  return [
    ...common,
    `Medición económica no evaluable: ${measurement.reasons.join(", ") || "sin motivo publicado"}.`,
    `Value Ledger no evaluable: ${(outcome.value_ledger.reasons ?? []).join(", ") || "sin motivo publicado"}.`,
  ];
}

function reasonLabel(reasons: readonly string[] | undefined): string {
  return reasons?.length ? reasons.join(", ") : "motivo no publicado";
}

function moneyOrUnknown(
  value: string | null | undefined,
  currency: string,
  reasons?: readonly string[],
): string {
  const amount = parseAmountOrNull(value);
  return amount == null ? `Sin dato · ${reasonLabel(reasons)}` : formatMoney(amount, currency);
}

function optionalMoneyField(
  label: string,
  value: string | null | undefined,
  currency: string,
  reasons: readonly string[] | undefined,
): OutcomeFinancialFieldView {
  return { label, value: moneyOrUnknown(value, currency, reasons) };
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * Adapta el contrato F9 sin recalcular valor, costo, atribución ni errores. La moneda proviene
 * exclusivamente del scope publicado por el backend; un null sigue siendo desconocido.
 */
export function outcomeDecisionView(
  outcome: OutcomeTrackingItem,
  currency: string,
): OutcomeDecisionView {
  const assessment = outcome.assessment;
  const ledger = outcome.value_ledger;
  const entry = ledger.entry;
  const projection = outcome.projection_error;
  const quote = outcome.quote_realization;

  const assessmentFields = [
    optionalMoneyField(
      "Resultado observado",
      assessment.actual_result,
      currency,
      assessment.reasons,
    ),
    optionalMoneyField("Monto observado", assessment.actual_amount, currency, assessment.reasons),
    optionalMoneyField("Costo observado", assessment.actual_cost, currency, assessment.reasons),
    optionalMoneyField("Recuperación", assessment.recovery_amount, currency, assessment.reasons),
    optionalMoneyField(
      "Exposición residual",
      assessment.residual_exposure,
      currency,
      assessment.reasons,
    ),
    {
      label: "Tasa efectiva",
      value: assessment.effective_rate ?? `Sin dato · ${reasonLabel(assessment.reasons)}`,
    },
  ];

  const ledgerFields = entry
    ? [
        optionalMoneyField("Valor bruto", entry.gross_value, currency, ledger.reasons),
        optionalMoneyField("Costo observado", entry.observed_cost, currency, ledger.reasons),
        optionalMoneyField("Valor neto", entry.net_value, currency, ledger.reasons),
      ]
    : [];

  const projectionFields = [
    optionalMoneyField("Error de proyección", projection.error, currency, projection.reasons),
  ];
  const quoteFields = [
    optionalMoneyField("Diferencia de monto", quote.amount_delta, currency, quote.reasons),
    optionalMoneyField("Diferencia de costo", quote.cost_delta, currency, quote.reasons),
    {
      label: "Diferencia de tasa",
      value: quote.rate_delta ?? `Sin dato · ${reasonLabel(quote.reasons)}`,
    },
    {
      label: "Diferencia de fecha valor",
      value:
        quote.value_date_delta_days == null
          ? `Sin dato · ${reasonLabel(quote.reasons)}`
          : `${quote.value_date_delta_days} días`,
    },
  ];

  return {
    id: outcome.outcome_ref,
    decisionRef: outcome.decision_ref,
    alternative: outcome.alternative_code,
    operationalState: outcome.operational_state,
    assessmentState: assessment.state,
    assessmentFields,
    assessmentReasons: [...(assessment.reasons ?? [])],
    valueLedgerState: ledger.state,
    attributedValue: moneyOrUnknown(entry?.attributed_value, currency, ledger.reasons),
    ledgerFields,
    attributionLabel: entry ? "Comparación prerregistrada contra no actuar, neta de costos" : null,
    confidence: entry?.confidence ?? assessment.confidence,
    projectionFields,
    quoteFields,
    traceGroups: [
      {
        key: "assessment",
        label: "Resultado observado",
        evidenceRefs: unique([...(assessment.evidence_refs ?? [])]),
        lineageRefs: unique([...(assessment.lineage_refs ?? [])]),
      },
      {
        key: "value_ledger",
        label: "Value Ledger",
        evidenceRefs: unique([...(ledger.evidence_refs ?? []), ...(entry?.evidence_refs ?? [])]),
        lineageRefs: unique([...(ledger.lineage_refs ?? []), ...(entry?.lineage_refs ?? [])]),
      },
      {
        key: "projection_error",
        label: "Error de proyección",
        evidenceRefs: unique([...(projection.evidence_refs ?? [])]),
        lineageRefs: unique([...(projection.lineage_refs ?? [])]),
      },
      {
        key: "quote_realization",
        label: "Cotización versus resultado",
        evidenceRefs: unique([...(quote.evidence_refs ?? [])]),
        lineageRefs: unique([...(quote.lineage_refs ?? [])]),
      },
    ],
    limitations: unique([
      ...(assessment.reasons ?? []),
      ...(ledger.reasons ?? []),
      ...(projection.reasons ?? []),
      ...(quote.reasons ?? []),
    ]),
  };
}
