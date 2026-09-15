import type { CashDecisionBrief } from "@/lib/api/cash-decision-brief";

/* Fixture de browser E2E para el envelope canónico. Se mantiene separado del
 * handler para que los valores que prueban contrato (id, hash y CTA) puedan
 * verificarse sin duplicarlos en cada spec. */
export const DECISION_BRIEF_E2E_DECISION_ID = "6cb9e47a-f682-46d6-9d8a-3c851c8ff420";

/* SHA-256 de `qavante-decision-brief-e2e-2026-09-12`: 64 hexadecimales
 * minúsculos, como publica el contrato. */
export const DECISION_BRIEF_E2E_CONTEXT_HASH =
  "ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f";

export const DECISION_BRIEF_E2E_CTA_HREFS = {
  reviewPayments:
    "/pagar?decision_id=6cb9e47a-f682-46d6-9d8a-3c851c8ff420&context_hash=ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f",
  viewProjection:
    "/caja/proyeccion?decision_id=6cb9e47a-f682-46d6-9d8a-3c851c8ff420&context_hash=ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f",
  reviewAudit:
    "/caja/por-clasificar?decision_id=6cb9e47a-f682-46d6-9d8a-3c851c8ff420&context_hash=ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f",
} as const;

/* `satisfies` hace que el mock evolucione con el contrato OpenAPI generado;
 * no es un shape inventado para que las pruebas pasen. */
export const DECISION_BRIEF_E2E_FIXTURE = {
  contract_version: "cash-decision-brief.v1",
  decision_id: DECISION_BRIEF_E2E_DECISION_ID,
  context_hash: DECISION_BRIEF_E2E_CONTEXT_HASH,
  as_of: "2026-09-12",
  horizon_days: 14,
  decision_kind: "financial_decision",
  state: "recommended",
  confidence: "high",
  currency: "CLP",
  problem: {
    title: "Tu caja no alcanza para cubrir los próximos pagos",
    summary: "En los próximos 14 días, los pagos programados superan la caja proyectada.",
    /* ".00" tal como lo publica un `NUMERIC(18,2)` del backend: el E2E comprueba
       que la pantalla lo muestra al peso y no como "$52.418.151,00". */
    amount: { amount: "52418151.00", currency: "CLP", label: "Faltante proyectado" },
  },
  alternatives: [
    {
      alternative_id: "d5e9dbcf-00d8-4e6e-bffd-9f67afdc4db7",
      code: "review_payments",
      decision_kind: "financial_decision",
      state: "available",
      title: "Revisar pagos próximos",
      description: "Revisa los pagos que vencen dentro del período antes de tomar una decisión.",
      cta_label: "Revisar pagos",
      cta_href: DECISION_BRIEF_E2E_CTA_HREFS.reviewPayments,
      requires_human_confirmation: true,
      targets: [
        {
          target_kind: "cash_gap",
          label: "Faltante proyectado",
          amount: { amount: "52418151", currency: "CLP", label: "Faltante proyectado" },
          due_by: "2026-09-26",
        },
      ],
    },
    {
      alternative_id: "05cc2271-facd-4c5a-92f8-cf6b55e1119c",
      code: "no_action",
      decision_kind: "financial_decision",
      state: "available",
      title: "No hacer cambios por ahora",
      description:
        "Mantén el plan actual y vuelve a revisar la proyección cuando llegue nueva información.",
      cta_label: "Ver proyección",
      cta_href: DECISION_BRIEF_E2E_CTA_HREFS.viewProjection,
      requires_human_confirmation: false,
      targets: [],
    },
  ],
  recommended_alternative_id: "d5e9dbcf-00d8-4e6e-bffd-9f67afdc4db7",
  evidence: [
    {
      kind: "cash_projection",
      label: "Menor saldo proyectado",
      note: "Proyección de caja de 14 días.",
      /* Residuo de conversión FX con doce decimales, como los strings medidos en la
         proyección productiva el 2026-09-15. La pantalla debe dejarlo en pesos. */
      amount: {
        amount: "-52418151.362000000000",
        currency: "CLP",
        label: "Menor saldo proyectado",
      },
      observed_on: "2026-09-12",
    },
    {
      kind: "scheduled_payments",
      label: "Pagos programados",
      note: "Compromisos con vencimiento dentro del período.",
      amount: { amount: "62200000", currency: "CLP", label: "Pagos programados" },
      observed_on: "2026-09-12",
    },
  ],
  freshness: {
    state: "current",
    as_of: "2026-09-12",
    summary: "Actualizada el 12-09-2026",
  },
  coverage: {
    state: "complete",
    summary: "La proyección incluye los saldos y pagos disponibles para este período.",
    dated_items: 8,
    undated_items: 0,
    /* INV-FX-001: lo que no es CLP queda FUERA de la evaluación y se declara.
       El fixture lo trae > 0 a propósito, para que la fila exista en el DOM y el
       E2E pueda afirmarla en positivo en vez de sólo comprobar su ausencia. */
    excluded_other_currency_items: 2,
    assumed_receivables_excluded: null,
    assumed_receivables_excluded_count: null,
  },
  uncertainties: [
    {
      kind: "pending_interpretation",
      summary: "12 movimientos están en revisión automática; no cambian esta evaluación.",
      item_count: 12,
      monetary_effect: "not_material_to_bank_balance",
      blocks_recommendation: false,
    },
  ],
  secondary_actions: [
    {
      decision_kind: "data_quality_audit",
      title: "Revisar movimientos pendientes",
      description: "Sólo si necesitas confirmar una excepción concreta.",
      item_count: 12,
      cta_label: "Abrir auditoría",
      cta_href: DECISION_BRIEF_E2E_CTA_HREFS.reviewAudit,
    },
  ],
} satisfies CashDecisionBrief;
