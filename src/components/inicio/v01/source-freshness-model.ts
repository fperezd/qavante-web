import type { SourceFreshnessRead } from "@/lib/api/financial-decision-readers";

export type FreshnessMetric = NonNullable<SourceFreshnessRead["freshness_metrics"]>[number];

const stateLabels: Record<FreshnessMetric["state"], string> = {
  fresh: "Vigente",
  stale: "Desactualizada",
  unavailable: "No disponible",
  unknown: "Desconocida",
};

export function freshnessStateLabel(state: FreshnessMetric["state"]): string {
  return stateLabels[state];
}

export function freshnessReasonLabel(reasons: readonly string[] | undefined): string {
  return reasons?.length ? reasons.join(", ") : "motivo no publicado";
}
