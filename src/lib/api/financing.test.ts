import { describe, expect, it } from "vitest";
import { evaluationV13 } from "@/components/financiamiento/v13/financiamiento-v13-fixtures";
import { toFinancingEvaluation, type WorkingCapitalRefinancingEvaluation } from "./financing";

describe("toFinancingEvaluation", () => {
  it("conserva el contrato completo que entregó el backend", () => {
    const contract = evaluationV13 as WorkingCapitalRefinancingEvaluation;

    const adapted = toFinancingEvaluation(contract);

    expect(adapted).toBe(contract);
    expect(adapted?.working_capital.state).toBe("observed_only");
    expect(adapted?.working_capital.reasons).toEqual(["verified_offer_required"]);
    expect(adapted?.refinancing.tradeoffs).toHaveLength(1);
    expect(adapted?.combinations.combinations).toHaveLength(1);
  });

  it("devuelve null sólo cuando no hay respuesta", () => {
    expect(toFinancingEvaluation(null)).toBeNull();
    expect(toFinancingEvaluation(undefined)).toBeNull();
  });
});
