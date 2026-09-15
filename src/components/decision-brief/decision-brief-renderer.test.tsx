import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { DECISION_BRIEF_E2E_FIXTURE } from "@/test/msw/decision-brief-fixture";
import {
  CASH_DECISION_BRIEF_V1,
  DecisionBriefRenderer,
  supportsCashDecisionBriefV1,
} from "./decision-brief-renderer";

describe("DecisionBriefRenderer — límite de versión", () => {
  it("presenta el contrato V1 generado", () => {
    expect(supportsCashDecisionBriefV1(DECISION_BRIEF_E2E_FIXTURE)).toBe(true);
    expect(CASH_DECISION_BRIEF_V1).toBe("cash-decision-brief.v1");
    expect(
      renderToStaticMarkup(<DecisionBriefRenderer brief={DECISION_BRIEF_E2E_FIXTURE} />),
    ).toContain("Tu caja no alcanza para cubrir los próximos pagos");
  });

  it("no interpreta un contrato futuro como V1 ni fabrica un plan local", () => {
    const v2 = {
      ...DECISION_BRIEF_E2E_FIXTURE,
      contract_version: "cash-decision-brief.v2",
    } as unknown as CashDecisionBrief;

    expect(supportsCashDecisionBriefV1(v2)).toBe(false);
    const rendered = renderToStaticMarkup(<DecisionBriefRenderer brief={v2} />);
    expect(rendered).toContain("versión que esta interfaz aún no puede presentar");
    expect(rendered).toContain("No mostramos una recomendación local");
    expect(rendered).not.toContain("Tu caja no alcanza para cubrir los próximos pagos");
  });
});
