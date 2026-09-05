import type {
  FxEvaluationRead,
  FxExposureRead,
  InvestmentEvaluationRead,
  InvestableSurplusRead,
  OutcomeValueRead,
} from "@/lib/api/financial-decision-readers";

export type OutcomeTrackingItem = NonNullable<OutcomeValueRead["outcomes"]>[number];

export type ReaderResponse =
  | FxExposureRead
  | FxEvaluationRead
  | InvestableSurplusRead
  | InvestmentEvaluationRead
  | OutcomeValueRead;

export type ReaderCollection = "exposures" | "evaluations" | "products" | "outcomes";

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
      `Value Ledger no evaluable: ${outcome.value_ledger.reasons.join(", ") || "sin motivo publicado"}.`,
    ];
  }

  return [
    ...common,
    `Medición económica no evaluable: ${measurement.reasons.join(", ") || "sin motivo publicado"}.`,
    `Value Ledger no evaluable: ${outcome.value_ledger.reasons.join(", ") || "sin motivo publicado"}.`,
  ];
}
