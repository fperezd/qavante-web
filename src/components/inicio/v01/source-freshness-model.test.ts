import { describe, expect, it } from "vitest";
import type { DecisionReadersView } from "./decision-read-panel";
import { freshnessReasonLabel, freshnessStateLabel } from "./source-freshness-model";

describe("F10 source freshness presentation", () => {
  it("accepts the published not_evaluable freshness snapshot", () => {
    const freshnessReader: DecisionReadersView["sourceFreshness"] = {
      data: {
        scope: {
          tenant_id: "00000000-0000-0000-0000-000000000001",
          legal_entity_id: "00000000-0000-0000-0000-000000000002",
          currency: "CLP",
          policy_code: "qavante.source_freshness",
          as_of: "2026-09-06T12:00:00Z",
        },
        source_refs: ["f9:snapshot"],
        freshness_summary: {
          state: "not_evaluable",
          reason_codes: ["policy_missing"],
        },
      },
      loading: false,
      failed: false,
    };

    expect(freshnessReader.data?.freshness_summary.state).toBe("not_evaluable");
  });

  it("labels server-owned freshness states without inferring a threshold", () => {
    expect(freshnessStateLabel("stale")).toBe("Desactualizada");
  });

  it("makes a missing reason explicit", () => {
    expect(freshnessReasonLabel([])).toBe("motivo no publicado");
    expect(freshnessReasonLabel(["policy_missing"])).toBe("policy_missing");
  });
});
