import { describe, expect, it } from "vitest";
import type { LiquidityEvaluation } from "@/lib/api/financial-decisions";
import { liquidityEvaluationView } from "./liquidity-evaluation-model";

const NOW = new Date("2026-08-31T12:00:00Z");

function evaluation(over: Partial<LiquidityEvaluation> = {}): LiquidityEvaluation {
  return {
    decision_id: "10000000-0000-4000-8000-000000000001",
    status: "evaluated",
    decision_support: "eligible",
    model_version: "fpde-f1",
    recommended_alternative_id: "line",
    scope: {
      legal_entity_id: "20000000-0000-4000-8000-000000000001",
      currency: "CLP",
      as_of: "2026-08-31T09:00:00Z",
      horizon_days: 90,
      valid_until: "2026-09-01T09:00:00Z",
    },
    situation: {},
    event: {
      amount_peak: "10000000",
      baseline_min_cash: "-8000000",
      recovery_date: "2026-09-20",
    },
    alternatives: [
      {
        id: "line",
        code: "credit_line:quote-1",
        family: "credit_line",
        rank: 1,
        is_no_action: false,
        is_rejected: false,
        explanation: { summary: "Cubre la brecha con términos vigentes." },
        parameters: {},
        simulation: {},
        comparison: {},
        cost_status: "known",
        cost: {
          status: "known",
          total_financial_cost: "250000",
          contract_version: "cost.v1",
          evidence_refs: ["quote:1"],
        },
      },
      {
        id: "factoring",
        code: "factoring:invoice-1",
        family: "factoring",
        rank: 2,
        is_no_action: false,
        is_rejected: false,
        explanation: {},
        parameters: {},
        simulation: {},
        comparison: {},
        cost_status: "unknown",
      },
      {
        id: "none",
        code: "no_action",
        family: "no_action",
        rank: 3,
        is_no_action: true,
        is_rejected: false,
        explanation: {},
        parameters: {},
        simulation: {},
        comparison: {},
        cost_status: "not_applicable",
      },
    ],
    ...over,
  };
}

describe("evaluación de liquidez en Hoy", () => {
  it("muestra las cifras y el ranking que entrega el backend", () => {
    const view = liquidityEvaluationView(evaluation(), NOW);

    expect(view.gapLabel).toBe("$10.000.000");
    expect(view.minimumCashLabel).toBe("−$8.000.000");
    expect(view.alternatives.map((item) => item.title)).toEqual([
      "Usar línea de crédito",
      "Factorizar factura completa",
      "No financiar",
    ]);
    expect(view.alternatives[0]?.recommended).toBe(true);
    expect(view.alternatives[0]?.costLabel).toBe("Costo financiero total $250.000");
  });

  it("unknown nunca se convierte en cero y no_action no recibe costo ficticio", () => {
    const view = liquidityEvaluationView(evaluation(), NOW);

    expect(view.alternatives[1]?.costLabel).toBe("Costo aún no verificable");
    expect(view.alternatives[1]?.costLabel).not.toContain("$0");
    expect(view.alternatives[2]?.costLabel).toBe("Costo financiero: no aplica");
  });

  it("declara vencida una evaluación expirada sin cambiar su ranking", () => {
    const value = evaluation({
      scope: { ...evaluation().scope, valid_until: "2026-08-30T09:00:00Z" },
    });
    const view = liquidityEvaluationView(value, NOW);

    expect(view.expired).toBe(true);
    expect(view.valid).toBe(false);
    expect(view.validityLabel).toContain("Venció");
    expect(view.alternatives.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("vigencia ausente o inválida no habilita una recomendación actual", () => {
    const missing = liquidityEvaluationView(
      evaluation({ scope: { ...evaluation().scope, valid_until: null } }),
      NOW,
    );
    const invalid = liquidityEvaluationView(
      evaluation({ scope: { ...evaluation().scope, valid_until: "no-es-fecha" } }),
      NOW,
    );

    expect(missing.valid).toBe(false);
    expect(missing.validityLabel).toBe("Vigencia no informada");
    expect(invalid.valid).toBe(false);
    expect(invalid.validityLabel).toContain("Vigencia inválida");
  });

  it("con abstención conserva el estado explícito", () => {
    expect(
      liquidityEvaluationView(evaluation({ decision_support: "abstain" }), NOW).decisionSupport,
    ).toBe("abstain");
  });
});
