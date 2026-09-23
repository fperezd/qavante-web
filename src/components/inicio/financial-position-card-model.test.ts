import { describe, expect, it } from "vitest";
import type { FinancialPosition } from "@/lib/api/financial-decisions";
import { positionPresentation, visiblePositionAmounts } from "./financial-position-card-model";

const base: FinancialPosition = {
  as_of: "2026-08-28",
  horizon_days: 30,
  integrity: "complete",
  freshness: "current",
  status: "eligible",
  has_conditional_due_dates: false,
};

describe("financial position Home presentation", () => {
  it("keeps abstained and partial distinct from ready", () => {
    expect(positionPresentation({ ...base, status: "abstained" })).toBe("abstained");
    expect(positionPresentation({ ...base, status: "partial" })).toBe("partial");
    expect(positionPresentation(base)).toBe("ready");
  });

  it("does not invent CLP when the backend omitted currency", () => {
    expect(visiblePositionAmounts({ ...base, current_cash: "1200" })).toEqual([]);
  });

  it("keeps only explicit numeric amounts", () => {
    expect(
      visiblePositionAmounts({
        ...base,
        currency: "USD",
        current_cash: "1200.50",
        minimum_projected_cash: "",
      }),
    ).toEqual([{ label: "Caja actual", value: 1200.5 }]);
  });
});
