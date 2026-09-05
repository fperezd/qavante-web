import { describe, expect, it } from "vitest";
import { itemCount, itemSummary, outcomeTrackingSummary } from "./decision-read-model";

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
      outcomeTrackingSummary({
        outcome_ref: "outcome-1",
        decision_ref: "decision-1",
        selected_alternative_ref: "alternative-1",
        alternative_code: "no_action",
        alternative_family: "cash_gap",
        selected_at: "2026-09-04T10:00:00Z",
        operational_state: "observed",
        task_summary: { total: 2, pending: 1, in_progress: 0, completed: 1, cancelled: 0 },
        economic_measurement: { state: "not_evaluable", reasons: ["reconciliation_pending"] },
        value_ledger: { state: "not_evaluable", reasons: ["baseline_missing"] },
      }),
    ).toEqual([
      "Estado operativo: observed.",
      "Tareas: 1 pendientes, 0 en curso, 1 completadas y 0 canceladas.",
      "Medición económica no evaluable: reconciliation_pending.",
      "Value Ledger no evaluable: baseline_missing.",
    ]);
  });

  it("keeps a partial observation distinct and publishes its measurement limit", () => {
    const summary = outcomeTrackingSummary({
      outcome_ref: "outcome-1",
      decision_ref: "decision-1",
      selected_alternative_ref: "alternative-1",
      alternative_code: "no_action",
      alternative_family: "cash_gap",
      selected_at: "2026-09-04T10:00:00Z",
      operational_state: "observed",
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
      value_ledger: { state: "not_evaluable", reasons: ["baseline_missing"] },
    });

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
});
