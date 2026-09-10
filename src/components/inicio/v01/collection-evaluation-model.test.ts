import { describe, expect, it } from "vitest";
import {
  collectionReadScopeFromFinancialScope,
  type CollectionEvaluation,
  type CollectionSituation,
} from "@/lib/api/collection-decisions";
import { collectionEvaluationView } from "./collection-evaluation-model";

const SCOPE = {
  tenant_id: "10000000-0000-4000-8000-000000000001",
  legal_entity_id: "20000000-0000-4000-8000-000000000001",
  currency: "CLP",
  as_of: "2026-09-01T12:00:00Z",
};

function evaluation(over: Partial<CollectionEvaluation> = {}): CollectionEvaluation {
  return {
    scope: SCOPE,
    state: "ready",
    freshness: "fresh",
    source_refs: ["source:rcv"],
    snapshot_hash: "snapshot-1",
    evaluations: [
      {
        subject_kind: "receivable",
        subject_ref: "receivable:1",
        state: "ready",
        alternatives: [
          {
            code: "accelerate_collection",
            eligibility_state: "not_evaluable",
            is_no_action: false,
            reason_codes: ["missing_due_date"],
            evidence_refs: [],
          },
        ],
      },
    ],
    ...over,
  };
}

function situation(over: Partial<CollectionSituation> = {}): CollectionSituation {
  return {
    scope: SCOPE,
    state: "ready",
    freshness: "fresh",
    source_refs: ["source:rcv"],
    snapshot_hash: "snapshot-1",
    receivables: [],
    payables: [],
    ...over,
  };
}

describe("collectionEvaluationView", () => {
  it("preserva abstención y sus motivos sin generar una alternativa", () => {
    const view = collectionEvaluationView(
      evaluation({
        state: "abstained",
        abstain_reasons: ["insufficient_evidence"],
        evaluations: [],
      }),
      situation(),
    );

    expect(view).toMatchObject({
      state: "abstained",
      stateLabel: "Qavante se abstuvo de recomendar",
      abstainReasons: ["insufficient_evidence"],
      subjects: [],
    });
  });

  it("transporta not_evaluable explícitamente y no lo convierte en elegible", () => {
    const view = collectionEvaluationView(evaluation(), situation());

    expect(view.subjects[0]?.alternatives[0]).toMatchObject({
      state: "not_evaluable",
      reasonCodes: ["missing_due_date"],
    });
  });

  it("cuenta documentos sin sumar ni convertir importes de distintas monedas", () => {
    const item = {
      kind: "receivables" as const,
      subject_ref: "receivable:1",
      counterparty_ref: "counterparty:1",
      currency: "USD",
      outstanding_amount: "100",
      issue_date: "2026-08-01",
      status: "open",
      freshness: "unknown" as const,
      observed_at: "2026-09-01T12:00:00Z",
      content_hash: "content-1",
      lineage_refs: [],
    };
    const view = collectionEvaluationView(evaluation(), situation({ receivables: [item] }));

    expect(view.receivables).toBe(1);
    expect(view).not.toHaveProperty("totalOutstanding");
  });

  it("transporta la abstención de situación y no convierte sus documentos ausentes en cero", () => {
    const view = collectionEvaluationView(
      evaluation({ receivables: [], payables: [] }),
      situation({
        state: "abstained",
        abstain_reasons: ["missing_collection_snapshot"],
        receivables: undefined,
        payables: undefined,
      }),
    );

    expect(view).toMatchObject({
      situationState: "abstained",
      situationAbstainReasons: ["missing_collection_snapshot"],
      receivables: null,
      payables: null,
    });
  });
});

describe("collectionReadScopeFromFinancialScope", () => {
  it("propaga sólo el scope financiero canónico al reader F3", () => {
    expect(
      collectionReadScopeFromFinancialScope({
        legal_entity_id: "entity-server-id",
        currency: "USD",
        as_of: "2026-09-09",
      }),
    ).toEqual({
      legal_entity_id: "entity-server-id",
      currency: "USD",
      as_of: "2026-09-09",
    });
  });

  it("mantiene F3 sin request cuando el scope canónico no existe", () => {
    expect(collectionReadScopeFromFinancialScope(null)).toBeNull();
  });
});
