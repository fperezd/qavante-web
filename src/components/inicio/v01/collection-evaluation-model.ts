import type { CollectionEvaluation, CollectionSituation } from "@/lib/api/collection-decisions";
import { formatDateLike } from "@/lib/formatters/date";

export type CollectionFreshness = "fresh" | "stale" | "unknown";
export type CollectionAlternativeState =
  | "eligible"
  | "potentially_eligible"
  | "ineligible"
  | "not_evaluable";

export interface CollectionEvaluationView {
  state: "ready" | "abstained";
  stateLabel: string;
  stateDescription: string;
  asOfLabel: string;
  freshness: CollectionFreshness;
  freshnessLabel: string;
  abstainReasons: string[];
  situationState: "ready" | "abstained" | null;
  situationAbstainReasons: string[];
  sourceRefs: string[];
  /** Null means the situation reader abstained, never an implicit zero. */
  receivables: number | null;
  /** Null means the situation reader abstained, never an implicit zero. */
  payables: number | null;
  subjects: Array<{
    id: string;
    subjectKind: "receivable" | "payable";
    subjectRef: string;
    state: "ready" | "observed_only" | "abstained";
    reasons: string[];
    alternatives: Array<{
      code: string;
      state: CollectionAlternativeState;
      isNoAction: boolean;
      reasonCodes: string[];
      evidenceRefs: string[];
    }>;
  }>;
}

const FRESHNESS_LABEL: Record<CollectionFreshness, string> = {
  fresh: "Datos vigentes",
  stale: "Datos desactualizados",
  unknown: "Frescura no informada",
};

/** Pure F3 adapter. It only labels published states; no recommendation or financial total is made. */
export function collectionEvaluationView(
  evaluation: CollectionEvaluation,
  situation: CollectionSituation | null,
): CollectionEvaluationView {
  const isAbstained = evaluation.state === "abstained";
  const situationAbstained = situation?.state === "abstained";
  return {
    state: evaluation.state,
    stateLabel: isAbstained ? "Qavante se abstuvo de recomendar" : "Evaluación disponible",
    stateDescription: isAbstained
      ? "La evidencia disponible no permite recomendar una acción de cobranza o reprogramación."
      : "Las alternativas se muestran tal como fueron evaluadas por el servidor.",
    asOfLabel: formatDateLike(evaluation.scope.as_of),
    freshness: evaluation.freshness,
    freshnessLabel: FRESHNESS_LABEL[evaluation.freshness],
    abstainReasons: evaluation.abstain_reasons ?? [],
    situationState: situation?.state ?? null,
    situationAbstainReasons: situation?.abstain_reasons ?? [],
    sourceRefs: evaluation.source_refs,
    receivables: situationAbstained
      ? null
      : (situation?.receivables?.length ?? evaluation.receivables?.length ?? 0),
    payables: situationAbstained
      ? null
      : (situation?.payables?.length ?? evaluation.payables?.length ?? 0),
    subjects: (evaluation.evaluations ?? []).map((subject) => ({
      id: `${subject.subject_kind}:${subject.subject_ref}`,
      subjectKind: subject.subject_kind,
      subjectRef: subject.subject_ref,
      state: subject.state,
      reasons: subject.reasons ?? [],
      alternatives: subject.alternatives.map((alternative) => ({
        code: alternative.code,
        state: alternative.eligibility_state,
        isNoAction: alternative.is_no_action,
        reasonCodes: alternative.reason_codes ?? [],
        evidenceRefs: alternative.evidence_refs ?? [],
      })),
    })),
  };
}
