import { describe, expect, it } from "vitest";
import {
  financialScopeKeys,
  serverAsOfDate,
  toFinancialDecisionReadScope,
} from "./financial-scope";

describe("serverAsOfDate", () => {
  it("uses the Chilean financial calendar date without consulting browser time", () => {
    expect(serverAsOfDate("2026-09-03T02:30:00Z")).toBe("2026-09-02");
    expect(serverAsOfDate("2026-09-03T04:30:00Z")).toBe("2026-09-03");
    expect(serverAsOfDate("2026-09-03")).toBe("2026-09-03");
  });

  it("fails closed for missing, malformed or impossible server cut-offs", () => {
    expect(serverAsOfDate(null)).toBeNull();
    expect(serverAsOfDate("2026-02-30")).toBeNull();
    expect(serverAsOfDate("2026-02-30T02:30:00Z")).toBeNull();
    expect(serverAsOfDate("03-09-2026")).toBeNull();
    expect(serverAsOfDate("2026-09-03T02:30:00")).toBeNull();
  });
});

describe("financialScopeKeys", () => {
  it("keeps server cut-off in the cache identity", () => {
    expect(financialScopeKeys.current("2026-09-03")).toEqual([
      "financial-scope",
      "current",
      "2026-09-03",
    ]);
  });
});

describe("toFinancialDecisionReadScope", () => {
  it("uses backend entity, functional currency and cut-off without a tenant or currency fallback", () => {
    expect(
      toFinancialDecisionReadScope({
        legal_entity_id: "entity-server-id",
        functional_currency_code: "USD",
        as_of: "2026-09-03",
        legal_entity_provenance: "single_active_legal_entity",
      }),
    ).toEqual({
      legal_entity_id: "entity-server-id",
      currency: "USD",
      as_of: "2026-09-03",
    });
  });

  it("keeps all readers disabled when canonical scope is absent", () => {
    expect(toFinancialDecisionReadScope(null)).toBeNull();
  });
});
