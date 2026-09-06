import { describe, expect, it } from "vitest";
import type { DecisionPlan } from "@/lib/api/decision-plans";
import { cashGapProposals } from "./cash-gap-proposal-model";

function plan(kind: DecisionPlan["kind"], state: DecisionPlan["state"] = "ready"): DecisionPlan {
  return {
    kind,
    state,
    summary: "Plan publicado por el backend",
    confidence: "medium",
    generated_at: "2026-09-06T12:00:00Z",
    alternatives: [
      {
        code: "prioridad",
        label:
          kind === "payment_plan" ? "Negociar pagos críticos" : "Cobrar documentos priorizados",
        rank: 1,
        recommended: true,
        explanation: "La evidencia publicada permite priorizar esta alternativa.",
        confidence: "medium",
        confidence_method: "evidence_bounded",
        evidence: [],
        impacts: [
          {
            metric: "cash_gap_14d",
            value: "120000",
            currency: "CLP",
            confidence: "medium",
            confidence_method: "evidence_bounded",
          },
        ],
        targets: [{ label: "Documento prioritario", amount: "120000", reason: "vence primero" }],
      },
    ],
    evidence: [],
    reasons: [],
  };
}

describe("cashGapProposals", () => {
  it("publica las propuestas recomendadas por el servidor con su módulo correcto", () => {
    const proposals = cashGapProposals(plan("payment_plan"), plan("collection_plan"));

    expect(proposals).toMatchObject([
      { kind: "payment_plan", href: "/pagar", cta: "Revisar pagos propuestos" },
      { kind: "collection_plan", href: "/cobrar", cta: "Revisar cobros propuestos" },
    ]);
  });

  it("no inventa una propuesta cuando el servidor se abstiene", () => {
    expect(cashGapProposals(plan("payment_plan", "abstain"), null)).toEqual([]);
  });
});
