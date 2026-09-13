import { describe, expect, it } from "vitest";
import type { CashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { shouldRenderDecisionCta, withDecisionContext } from "./cash-decision-brief";

const brief = {
  decision_id: "10000000-0000-4000-8000-000000000001",
  context_hash: "cash-cut-123",
} as CashDecisionBrief;

describe("withDecisionContext", () => {
  it("preserves the concrete plan and carries server correlation identifiers", () => {
    expect(withDecisionContext("/pagar?tab=critical", brief)).toBe(
      "/pagar?tab=critical&decision_id=10000000-0000-4000-8000-000000000001&context_hash=cash-cut-123",
    );
  });

  it("replaces an obsolete decision id instead of sending a stale plan context", () => {
    expect(withDecisionContext("/caja/proyeccion?decision_id=old", brief)).toBe(
      "/caja/proyeccion?decision_id=10000000-0000-4000-8000-000000000001&context_hash=cash-cut-123",
    );
  });
});

describe("shouldRenderDecisionCta", () => {
  it("keeps a server-owned source-recovery CTA visible when the brief abstains", () => {
    expect(shouldRenderDecisionCta({ cta_label: "Ver conexiones", cta_href: "/conexiones" })).toBe(
      true,
    );
  });

  it("does not manufacture a CTA from incomplete alternative data", () => {
    expect(shouldRenderDecisionCta({ cta_label: "Ver conexiones" })).toBe(false);
  });
});
