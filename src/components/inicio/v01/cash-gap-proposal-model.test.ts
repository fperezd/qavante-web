import { describe, expect, it } from "vitest";
import type { DecisionPlan } from "@/lib/api/decision-plans";
import { cashGapProposals } from "./cash-gap-proposal-model";

function plan(
  kind: DecisionPlan["kind"],
  state: DecisionPlan["state"] = "ready",
  confidence: DecisionPlan["confidence"] = "medium",
  evidence: NonNullable<DecisionPlan["evidence"]> = [],
): DecisionPlan {
  return {
    kind,
    state,
    summary: "Plan publicado por el backend",
    confidence,
    generated_at: "2026-09-06T12:00:00Z",
    alternatives: [
      {
        code: "prioridad",
        label:
          kind === "payment_plan" ? "Negociar pagos críticos" : "Cobrar documentos priorizados",
        rank: 1,
        recommended: true,
        explanation: "La evidencia publicada permite priorizar esta alternativa.",
        confidence,
        confidence_method: "evidence_bounded",
        evidence,
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
    evidence,
    reasons: [],
  };
}

function sourceEvidence(
  integrityState: string,
  freshnessState: "fresh" | "stale" | "unknown",
): NonNullable<DecisionPlan["evidence"]>[number] {
  return {
    metric_code: "source_metric",
    label: "Fuente de la propuesta",
    value: "120000",
    source: "treasury.source",
    as_of: "2026-09-06",
    integrity_state: integrityState,
    freshness_state: freshnessState,
    reference: "internal_reference",
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

  it("conserva el límite publicado por el servidor sin inferir frescura", () => {
    const payment = plan("payment_plan", "ready", "low", [sourceEvidence("available", "stale")]);
    payment.reasons = ["source_stale:sii_rcv"];

    expect(cashGapProposals(payment, null)[0]?.limitations).toEqual(["source_stale:sii_rcv"]);
  });

  it("conserva evidencia del plan aunque la alternativa publique evidence vacío", () => {
    const payment = plan("payment_plan", "ready", "low", [sourceEvidence("available", "stale")]);
    payment.alternatives![0]!.evidence = [];
    payment.reasons = [];

    const proposal = cashGapProposals(payment, null)[0];
    expect(proposal?.evidenceCount).toBe(1);
    expect(proposal?.limitations).toEqual([]);
  });

  it("muestra el límite publicado en un plan ready preliminar", () => {
    const collection = plan("collection_plan", "ready", "preliminary", [
      sourceEvidence("partial", "fresh"),
    ]);
    collection.reasons = ["missing_due_dates"];

    expect(cashGapProposals(null, collection)[0]?.limitations).toEqual(["missing_due_dates"]);
  });

  it("no reemplaza una razón no reconocida por un aviso genérico", () => {
    const payment = plan("payment_plan");
    payment.reasons = ["engine_private_reason"];

    expect(cashGapProposals(payment, null)[0]?.limitations).toEqual(["engine_private_reason"]);
  });

  it("no recalcula un límite de política publicado", () => {
    const payment = plan("payment_plan");
    payment.reasons = ["missing_policy:versioned_cash_safety_minimum"];

    expect(cashGapProposals(payment, null)[0]?.limitations).toEqual([
      "missing_policy:versioned_cash_safety_minimum",
    ]);
  });
});
