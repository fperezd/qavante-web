import type { DecisionPlan } from "@/lib/api/decision-plans";

export interface CashGapProposal {
  kind: "payment_plan" | "collection_plan";
  label: string;
  explanation: string;
  confidence: "high" | "medium" | "low" | "preliminary";
  evidenceCount: number;
  caveats: string[];
  targets: NonNullable<NonNullable<DecisionPlan["alternatives"]>[number]["targets"]>;
  impacts: NonNullable<NonNullable<DecisionPlan["alternatives"]>[number]["impacts"]>;
  href: "/pagar" | "/cobrar";
  cta: string;
}

const STALE_REASON = /stale|expired|desactual|sincroniz|fuente_vieja/i;
const INCOMPLETE_REASON =
  /partial|incomplete|missing|falt|pendiente|sin documentos|sin vencimiento|sin fecha/i;
const POLICY_REASON =
  /policyconstraint|policy_constraint|missing_policy|approval_policy|cash_safety_minimum/i;

/**
 * Conserva la señal de incertidumbre sin exponer nombres internos del motor.
 * Una razón desconocida también se declara: ocultarla convertiría evidencia
 * acotada en una propuesta aparentemente completa.
 */
export function proposalCaveats(
  reasons: readonly string[] | undefined,
  evidence: NonNullable<DecisionPlan["evidence"]> = [],
): string[] {
  const caveats: string[] = [];
  if (evidence.some((item) => item.freshness_state === "stale")) {
    caveats.push("Una o más fuentes pueden estar desactualizadas.");
  }
  if (evidence.some((item) => item.freshness_state === "unknown")) {
    caveats.push("No fue posible verificar la actualización de una o más fuentes.");
  }
  if (evidence.some((item) => item.integrity_state === "partial")) {
    caveats.push(
      "La propuesta se basa en información parcial; pueden faltar documentos o vencimientos.",
    );
  }

  caveats.push(
    ...(reasons ?? []).map((reason) => {
      if (POLICY_REASON.test(reason)) {
        return "La empresa aún no tiene configurado un criterio de caja vigente para esta propuesta.";
      }
      if (STALE_REASON.test(reason)) {
        return "Una o más fuentes pueden estar desactualizadas.";
      }
      if (INCOMPLETE_REASON.test(reason)) {
        return "La propuesta se basa en información parcial; pueden faltar documentos o vencimientos.";
      }
      return "Esta propuesta usa evidencia limitada; revisa los datos antes de actuar.";
    }),
  );

  return [...new Set(caveats)];
}

function combinedEvidence(
  plan: DecisionPlan,
  alternative: NonNullable<DecisionPlan["alternatives"]>[number],
): NonNullable<DecisionPlan["evidence"]> {
  const evidence = [...(plan.evidence ?? []), ...(alternative.evidence ?? [])];
  return [
    ...new Map(
      evidence.map((item) => [
        [
          item.metric_code,
          item.source,
          item.reference,
          item.as_of,
          item.value,
          item.integrity_state,
          item.freshness_state,
        ].join("\u0000"),
        item,
      ]),
    ).values(),
  ];
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
    const evidence = combinedEvidence(plan, alternative);
    return [
      {
        kind: plan.kind,
        label: alternative.label,
        explanation: alternative.explanation,
        confidence: alternative.confidence,
        evidenceCount: evidence.length,
        caveats: proposalCaveats(plan.reasons, evidence),
        targets: alternative.targets ?? [],
        impacts: alternative.impacts ?? [],
        href: paymentPlan ? "/pagar" : "/cobrar",
        cta: paymentPlan ? "Revisar pagos propuestos" : "Revisar cobros propuestos",
      },
    ];
  });
}
