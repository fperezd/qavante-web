import type { DecisionPlan } from "@/lib/api/decision-plans";

export interface CashGapProposal {
  kind: "payment_plan" | "collection_plan";
  label: string;
  explanation: string;
  confidence: "high" | "medium" | "low" | "preliminary";
  evidenceCount: number;
  targets: NonNullable<NonNullable<DecisionPlan["alternatives"]>[number]["targets"]>;
  impacts: NonNullable<NonNullable<DecisionPlan["alternatives"]>[number]["impacts"]>;
  href: "/pagar" | "/cobrar";
  cta: string;
}

/**
 * Conserva únicamente la alternativa que el servidor recomendó en un plan listo.
 * El navegador no rankea, no suma impactos ni convierte una abstención en propuesta.
 */
export function cashGapProposals(
  payment: DecisionPlan | null | undefined,
  collection: DecisionPlan | null | undefined,
): CashGapProposal[] {
  return [payment, collection].flatMap((plan) => {
    if (!plan || plan.state !== "ready") return [];
    const alternative = plan.alternatives?.find((item) => item.recommended);
    if (!alternative) return [];

    const paymentPlan = plan.kind === "payment_plan";
    return [
      {
        kind: plan.kind,
        label: alternative.label,
        explanation: alternative.explanation,
        confidence: alternative.confidence,
        evidenceCount: alternative.evidence?.length ?? plan.evidence?.length ?? 0,
        targets: alternative.targets ?? [],
        impacts: alternative.impacts ?? [],
        href: paymentPlan ? "/pagar" : "/cobrar",
        cta: paymentPlan ? "Revisar pagos propuestos" : "Revisar cobros propuestos",
      },
    ];
  });
}
