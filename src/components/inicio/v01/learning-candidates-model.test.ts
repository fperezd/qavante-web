import { describe, expect, it } from "vitest";
import type { DecisionReadersView } from "./decision-read-panel";
import {
  learningKindLabel,
  learningReasonLabel,
  uniqueReferences,
} from "./learning-candidates-model";

describe("F10 learning candidate presentation", () => {
  it("accepts F10's explicit not_evaluable reader state", () => {
    const learningReader: DecisionReadersView["learningCandidates"] = {
      data: {
        scope: {
          tenant_id: "00000000-0000-0000-0000-000000000001",
          legal_entity_id: "00000000-0000-0000-0000-000000000002",
          currency: "CLP",
          as_of: "2026-09-05T12:00:00Z",
        },
        state: "not_evaluable",
        source_refs: ["f9:snapshot"],
        reasons: ["evidence_missing"],
      },
      loading: false,
      failed: false,
    };

    expect(learningReader.data?.state).toBe("not_evaluable");
  });

  it("labels server-owned kinds without deriving a rank or causal conclusion", () => {
    expect(learningKindLabel("quote_realization")).toBe("Cotización y resultado");
  });

  it("keeps a missing reason explicit", () => {
    expect(learningReasonLabel([])).toBe("motivo no publicado");
    expect(learningReasonLabel(["evidence_missing"])).toBe("evidence_missing");
  });

  it("preserves distinct provenance references", () => {
    expect(uniqueReferences([["source:one", "source:one"], ["source:two"]])).toEqual([
      "source:one",
      "source:two",
    ]);
  });
});
