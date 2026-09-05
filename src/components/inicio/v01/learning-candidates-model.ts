import type { LearningCandidateRead } from "@/lib/api/financial-decision-readers";

export type LearningCandidate = NonNullable<LearningCandidateRead["signals"]>[number];

const kindLabels: Record<LearningCandidate["kind"], string> = {
  collection_behavior: "Comportamiento de cobranza",
  forecast_calibration: "Calibración de proyección",
  operation_cost_duration: "Costo o duración operativa",
  quote_realization: "Cotización y resultado",
  liquidity_redemption: "Rescate de liquidez",
  fx_residual_exposure: "Exposición FX residual",
  source_quality_drift: "Cambio en calidad de fuente",
};

/** Labels only: the server-owned kind is never ranked, scored or interpreted as causality. */
export function learningKindLabel(kind: LearningCandidate["kind"]): string {
  return kindLabels[kind];
}

export function learningReasonLabel(reasons: readonly string[] | undefined): string {
  return reasons?.length ? reasons.join(", ") : "motivo no publicado";
}

export function uniqueReferences(values: Array<readonly string[] | undefined>): string[] {
  return [...new Set(values.flatMap((value) => value ?? []))];
}
