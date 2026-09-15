import { describe, expect, it } from "vitest";
import {
  DECISION_BRIEF_E2E_CONTEXT_HASH,
  DECISION_BRIEF_E2E_CTA_HREFS,
  DECISION_BRIEF_E2E_DECISION_ID,
  DECISION_BRIEF_E2E_FIXTURE,
} from "./decision-brief-fixture";

describe("fixture MSW de CashDecisionBrief", () => {
  it("mantiene los valores de identidad que exige el contrato", () => {
    expect(DECISION_BRIEF_E2E_FIXTURE.contract_version).toBe("cash-decision-brief.v1");
    expect(DECISION_BRIEF_E2E_FIXTURE.decision_id).toBe(DECISION_BRIEF_E2E_DECISION_ID);
    expect(DECISION_BRIEF_E2E_CONTEXT_HASH).toMatch(/^[a-f0-9]{64}$/);
    expect(DECISION_BRIEF_E2E_FIXTURE.context_hash).toBe(DECISION_BRIEF_E2E_CONTEXT_HASH);
  });

  it("publica un conteo de otra moneda distinto de cero para que INV-FX-001 sea observable", () => {
    expect(DECISION_BRIEF_E2E_FIXTURE.coverage.excluded_other_currency_items).toBe(2);
  });

  it("publica cada CTA con sólo decision_id y context_hash, en ese orden", () => {
    for (const href of Object.values(DECISION_BRIEF_E2E_CTA_HREFS)) {
      const url = new URL(href, "https://app.qavante.test");
      expect(url.search).toBe(
        `?decision_id=${DECISION_BRIEF_E2E_DECISION_ID}&context_hash=${DECISION_BRIEF_E2E_CONTEXT_HASH}`,
      );
      expect([...url.searchParams.keys()]).toEqual(["decision_id", "context_hash"]);
    }
  });
});
