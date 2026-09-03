import type {
  FxEvaluationRead,
  FxExposureRead,
  InvestmentEvaluationRead,
  InvestableSurplusRead,
  OutcomeValueRead,
} from "@/lib/api/financial-decision-readers";

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
