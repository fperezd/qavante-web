import { describe, expect, it } from "vitest";
import {
  itemCount,
  itemSummary,
  outcomeDecisionView,
  outcomeTrackingSummary,
  type OutcomeTrackingItem,
} from "./decision-read-model";

function persistedOutcome(over: Partial<OutcomeTrackingItem> = {}): OutcomeTrackingItem {
  return {
    outcome_ref: "outcome-1",
    decision_ref: "decision-1",
    selected_alternative_ref: "alternative-1",
    alternative_code: "no_action",
    alternative_family: "cash_gap",
    selected_at: "2026-09-04T10:00:00Z",
    operational_state: "observed",
    economic_measurement: { state: "not_evaluable", reasons: ["reconciliation_pending"] },
    assessment: {
      state: "not_evaluable",
      source_quality: "unavailable",
      confidence: "unknown",
      reasons: ["reconciliation_pending"],
    },
    value_ledger: { state: "not_evaluable", reasons: ["baseline_missing"] },
    projection_error: { state: "not_evaluable", reasons: ["projection_missing"] },
    quote_realization: { state: "not_evaluable", reasons: ["verified_quote_missing"] },
    ...over,
  };
}

describe("DecisionReadPanel honesty boundary", () => {
  it("counts only the collection named by the published reader", () => {
    const fxEvaluation = {
      exposures: [{ source: "observed" }],
      evaluations: [{ state: "abstained" }, { state: "abstained" }],
    };

    expect(itemCount(fxEvaluation as never, "evaluations")).toBe(2);
    expect(itemCount(fxEvaluation as never, "exposures")).toBe(1);
  });

  it("does not turn an absent detail into a financial zero", () => {
    expect(itemSummary(null, "resultado", "resultados")).toContain("sin detalle contable");
    expect(itemSummary(null, "resultado", "resultados")).not.toContain("0");
  });

  it("uses the explicit Spanish plural supplied by the caller", () => {
    expect(itemSummary(2, "evaluación", "evaluaciones")).toBe(
      "2 evaluaciones publicadas; no representa un monto.",
    );
  });

  it("keeps F9 operational facts and both measurement abstentions distinct", () => {
    expect(
      outcomeTrackingSummary(
        persistedOutcome({
          task_summary: { total: 2, pending: 1, in_progress: 0, completed: 1, cancelled: 0 },
        }),
      ),
    ).toEqual([
      "Estado operativo: observed.",
      "Tareas: 1 pendientes, 0 en curso, 1 completadas y 0 canceladas.",
      "Medición económica no evaluable: reconciliation_pending.",
      "Value Ledger no evaluable: baseline_missing.",
    ]);
  });

  it("keeps a partial observation distinct and publishes its measurement limit", () => {
    const summary = outcomeTrackingSummary(
      persistedOutcome({
        economic_measurement: {
          state: "partial",
          reasons: ["cost_not_reconciled"],
          outcome_key: "outcome-1",
          metric_code: "cash_impact",
          metric_basis: "net_after_cost",
          period_start: "2026-09-01",
          period_end: "2026-09-03",
          observed_at: "2026-09-04T10:00:00Z",
          source_refs: ["movement:1"],
          evidence_hashes: ["hash:1"],
          lineage_refs: ["reconciliation:1"],
        },
      }),
    );

    expect(summary).toEqual(
      expect.arrayContaining([
        "Medición económica parcial observada: cash_impact (net_after_cost) entre 2026-09-01 y 2026-09-03.",
        "Límites de medición parcial: cost_not_reconciled.",
        "Hashes de evidencia: hash:1.",
        "Evidencia de medición: movement:1; linaje: reconciliation:1.",
      ]),
    );
    expect(summary).toContain("Límites de medición parcial: cost_not_reconciled.");
    expect(summary).not.toContain("Medición económica no evaluable: cost_not_reconciled.");
  });

  it("renders an observed attributed value from the backend and preserves negative amounts", () => {
    const view = outcomeDecisionView(
      persistedOutcome({
        assessment: {
          state: "observed",
          source_quality: "verified_fresh",
          confidence: "high",
          actual_result: "-125000",
          actual_cost: "25000",
          evidence_refs: ["movement:1"],
          lineage_refs: ["reconciliation:1"],
        },
        value_ledger: {
          state: "observed",
          entry: {
            gross_value: "-100000",
            observed_cost: "25000",
            net_value: "-125000",
            attributed_value: "-125000",
            attribution_method: "preregistered_no_action_net_of_cost",
            confidence: "high",
            evidence_refs: ["ledger:1"],
            lineage_refs: ["baseline:1"],
          },
          evidence_refs: ["ledger:1"],
        },
      }),
      "CLP",
    );

    expect(view.attributedValue).toBe("−$125.000");
    expect(view.assessmentFields).toContainEqual({
      label: "Resultado observado",
      value: "−$125.000",
    });
    expect(view.attributionLabel).toContain("no actuar");
    expect(view.traceGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "assessment",
          evidenceRefs: ["movement:1"],
          lineageRefs: ["reconciliation:1"],
        }),
        expect.objectContaining({
          key: "value_ledger",
          evidenceRefs: ["ledger:1"],
          lineageRefs: ["baseline:1"],
        }),
      ]),
    );
  });

  it("keeps unknown fields as Sin dato with the published reason, never zero", () => {
    const view = outcomeDecisionView(persistedOutcome(), "CLP");

    expect(view.attributedValue).toBe("Sin dato · baseline_missing");
    expect(view.assessmentFields.every((field) => field.value.includes("Sin dato"))).toBe(true);
    expect(view.quoteFields.every((field) => field.value.includes("Sin dato"))).toBe(true);
    expect(JSON.stringify(view)).not.toContain("$0");
  });

  it("uses only the response scope currency when formatting a persisted amount", () => {
    const outcome = persistedOutcome({
      value_ledger: {
        state: "observed",
        entry: {
          gross_value: "10.5",
          observed_cost: "0.5",
          net_value: "10",
          attributed_value: "10",
          attribution_method: "preregistered_no_action_net_of_cost",
          confidence: "medium",
          evidence_refs: ["ledger:usd"],
        },
      },
    });

    expect(outcomeDecisionView(outcome, "USD").attributedValue).toContain("US$");
  });

  it("formats a negative projection error as CLP from the response scope", () => {
    const view = outcomeDecisionView(
      persistedOutcome({
        projection_error: {
          state: "observed",
          error: "-125000",
          evidence_refs: ["projection:clp"],
          lineage_refs: ["forecast:clp"],
        },
      }),
      "CLP",
    );

    expect(view.projectionFields).toEqual([{ label: "Error de proyección", value: "−$125.000" }]);
  });

  it("formats a negative projection error as USD from the response scope", () => {
    const view = outcomeDecisionView(
      persistedOutcome({
        projection_error: {
          state: "observed",
          error: "-1234.5",
          evidence_refs: ["projection:usd"],
          lineage_refs: ["forecast:usd"],
        },
      }),
      "USD",
    );
    const projectionError = view.projectionFields[0]!.value;

    expect(projectionError).toBe("−US$ 1.234,50");
    expect(view.traceGroups.find((group) => group.key === "projection_error")).toMatchObject({
      evidenceRefs: ["projection:usd"],
      lineageRefs: ["forecast:usd"],
    });
  });

  it("does not flatten trace refs shared by different measurement families", () => {
    const view = outcomeDecisionView(
      persistedOutcome({
        assessment: {
          state: "partial",
          source_quality: "verified_fresh",
          confidence: "medium",
          evidence_refs: ["shared:1"],
          lineage_refs: ["assessment:lineage"],
        },
        value_ledger: {
          state: "not_evaluable",
          reasons: ["baseline_missing"],
          evidence_refs: ["shared:1"],
          lineage_refs: ["ledger:lineage"],
        },
        quote_realization: {
          state: "partial",
          reasons: ["quote_cost_missing"],
          evidence_refs: ["quote:1"],
          lineage_refs: ["quote:lineage"],
        },
      }),
      "CLP",
    );

    expect(view.traceGroups.find((group) => group.key === "assessment")?.evidenceRefs).toEqual([
      "shared:1",
    ]);
    expect(view.traceGroups.find((group) => group.key === "value_ledger")?.evidenceRefs).toEqual([
      "shared:1",
    ]);
    expect(view.traceGroups.find((group) => group.key === "quote_realization")).toMatchObject({
      evidenceRefs: ["quote:1"],
      lineageRefs: ["quote:lineage"],
    });
  });
});
