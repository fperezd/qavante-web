import { describe, expect, it } from "vitest";
import { itemCount, itemSummary } from "./decision-read-model";

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
});
