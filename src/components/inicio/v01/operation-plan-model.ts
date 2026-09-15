import type {
  DecisionSelectionResponse,
  LiquidityEvaluation,
  OperationPlanRead,
} from "@/lib/api/financial-decisions";
import { ApiError } from "@/lib/api/errors";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { liquidityEvaluationView } from "./liquidity-evaluation-model";

/**
 * Boundary de presentación de F2.
 *
 * No es un contrato de red: el adapter consume el snapshot OpenAPI publicado por
 * qavante-api#306 sin completar campos ausentes ni inferir estados o checklist en el cliente.
 */
export type OperationPlanTone = "neutral" | "info" | "warning" | "success";

export type OperationPlanChecklistState = "complete" | "pending" | "blocked" | "unknown";

export interface OperationPlanChecklistItemView {
  id: string;
  label: string;
  state: OperationPlanChecklistState;
  detail?: string | null;
}

export interface OperationPlanPresentView {
  kind: "present";
  planId: string;
  status: string;
  statusLabel: string;
  statusDescription: string;
  statusTone: OperationPlanTone;
  readOnly: boolean;
  alternativeTitle: string;
  selectionRationale: string | null;
  selectedAtLabel: string | null;
  costLabel: string;
  evidenceLabel: string;
  validityLabel: string;
  checklist: OperationPlanChecklistItemView[];
  checklistCompletionStatus: "not_evaluated" | null;
  canRequestApproval: boolean;
  approvalEvidenceRefs: string[];
  errors: Array<{ id: string; label: string; detail: string | null }>;
}

export interface OperationPlanAbsentView {
  kind: "absent";
  reason: "no_action" | "abstain" | "not_informed";
  title: string;
  description: string;
  reasons: string[];
}

export type OperationPlanView = OperationPlanPresentView | OperationPlanAbsentView;

type OperationStatus = NonNullable<
  NonNullable<OperationPlanRead["operation_plan"]>["current_status"]
>;
type OperationStatusCopy = Pick<
  OperationPlanPresentView,
  "statusLabel" | "statusDescription" | "statusTone" | "readOnly"
>;

const STATUS = {
  draft: {
    statusLabel: "Borrador",
    statusDescription: "El plan está preparado, pero aún no fue enviado a aprobación.",
    statusTone: "info",
    readOnly: false,
  },
  awaiting_approval: {
    statusLabel: "Esperando aprobación",
    statusDescription: "La solicitud fue registrada. Esta vista no aprueba ni ejecuta el plan.",
    statusTone: "warning",
    readOnly: true,
  },
  approved: {
    statusLabel: "Aprobado",
    statusDescription: "El estado fue informado por Qavante. Esta vista es sólo lectura.",
    statusTone: "success",
    readOnly: true,
  },
  submitted: {
    statusLabel: "Enviado",
    statusDescription: "El plan fue enviado y está a la espera de procesamiento.",
    statusTone: "info",
    readOnly: true,
  },
  acknowledged: {
    statusLabel: "Recibido",
    statusDescription: "La recepción del plan fue confirmada. Esta vista es sólo lectura.",
    statusTone: "info",
    readOnly: true,
  },
  in_evaluation: {
    statusLabel: "En evaluación",
    statusDescription: "El plan está siendo evaluado. Esta vista es sólo lectura.",
    statusTone: "warning",
    readOnly: true,
  },
  approved_by_provider: {
    statusLabel: "Aprobado por proveedor",
    statusDescription: "El proveedor aprobó el plan. Esta vista es sólo lectura.",
    statusTone: "success",
    readOnly: true,
  },
  rejected_by_provider: {
    statusLabel: "Rechazado por proveedor",
    statusDescription: "El proveedor no aprobó el plan. Esta vista es sólo lectura.",
    statusTone: "neutral",
    readOnly: true,
  },
  cancelled: {
    statusLabel: "Cancelado",
    statusDescription: "El plan ya no está activo. Esta vista es sólo lectura.",
    statusTone: "neutral",
    readOnly: true,
  },
  expired: {
    statusLabel: "Vencido",
    statusDescription: "La vigencia terminó. Esta vista es sólo lectura.",
    statusTone: "warning",
    readOnly: true,
  },
  funded_or_effective: {
    statusLabel: "Activo",
    statusDescription: "El plan está vigente. Esta vista es sólo lectura.",
    statusTone: "success",
    readOnly: true,
  },
  settled: {
    statusLabel: "Liquidado",
    statusDescription: "El plan fue liquidado. Esta vista es sólo lectura.",
    statusTone: "success",
    readOnly: true,
  },
  observed: {
    statusLabel: "Con observaciones",
    statusDescription: "El plan requiere revisión. Esta vista es sólo lectura.",
    statusTone: "warning",
    readOnly: true,
  },
  closed: {
    statusLabel: "Cerrado",
    statusDescription: "El plan está cerrado. Esta vista es sólo lectura.",
    statusTone: "neutral",
    readOnly: true,
  },
} satisfies Record<OperationStatus, OperationStatusCopy>;

const UNKNOWN_STATUS: OperationStatusCopy = {
  statusLabel: "Estado no disponible",
  statusDescription:
    "El plan informó un estado que aún no podemos presentar. Esta vista es sólo lectura.",
  statusTone: "neutral",
  readOnly: true,
};

export function operationPlanStatusView(status: string): OperationStatusCopy {
  return Object.hasOwn(STATUS, status) ? STATUS[status as OperationStatus] : UNKNOWN_STATUS;
}

export function noActionOperationPlanView(): OperationPlanAbsentView {
  return {
    kind: "absent",
    reason: "no_action",
    title: "No financiar no crea un plan operativo",
    description:
      "La abstención de ejecutar financiamiento quedó explícita. No hay solicitud, aprobación ni movimiento de dinero.",
    reasons: [],
  };
}

export function abstainOperationPlanView(reasons: string[]): OperationPlanAbsentView {
  return {
    kind: "absent",
    reason: "abstain",
    title: "No hay plan operativo",
    description: "Qavante informó una abstención para esta decisión.",
    reasons,
  };
}

export function operationPlanNotInformedView(): OperationPlanAbsentView {
  return {
    kind: "absent",
    reason: "not_informed",
    title: "Plan operativo no informado",
    description:
      "La respuesta no incluye un plan ni una causa de abstención. No inferimos el motivo.",
    reasons: [],
  };
}

/**
 * Adapter transitorio, limitado al POST de selección ya publicado en OpenAPI.
 * Sólo puede producir `draft` o ausencia por `no_action`; checklist y solicitud de aprobación se
 * mantienen fail-closed hasta que #299 publique el reader estable.
 */
export function operationPlanViewFromSelection(
  evaluation: LiquidityEvaluation,
  selection: DecisionSelectionResponse,
  now: Date = new Date(),
): OperationPlanView | null {
  if (selection.decision_id !== evaluation.decision_id) return null;
  const alternative = liquidityEvaluationView(evaluation, now).alternatives.find(
    (item) => item.id === selection.alternative_id,
  );

  if (!selection.operation_required && selection.operation_plan_id == null) {
    return noActionOperationPlanView();
  }
  if (!selection.operation_plan_id || !selection.operation_status || !alternative) return null;

  const status = operationPlanStatusView(selection.operation_status);
  return {
    kind: "present",
    planId: selection.operation_plan_id,
    status: selection.operation_status,
    ...status,
    alternativeTitle: alternative.title,
    selectionRationale: null,
    selectedAtLabel: null,
    costLabel: alternative.costLabel,
    evidenceLabel: alternative.evidenceLabel ?? "Evidencia no informada",
    validityLabel: liquidityEvaluationView(evaluation, now).validityLabel,
    checklist: [],
    checklistCompletionStatus: null,
    canRequestApproval: false,
    approvalEvidenceRefs: [],
    errors: [],
  };
}

function readAlternativeTitle(code: string, family: string): string {
  if (code === "no_action" || family === "no_action") return "No financiar";
  if (code.startsWith("credit_line") || family === "credit_line") return "Usar línea de crédito";
  if (code.startsWith("factoring") || family === "factoring") {
    return "Factorizar factura completa";
  }
  return "Alternativa seleccionada";
}

function readCostLabel(plan: NonNullable<OperationPlanRead["operation_plan"]>): string {
  if (plan.cost?.status !== "known") return "Costo aún no verificable";
  const amount = parseAmountOrNull(plan.cost.total_financial_cost ?? null);
  return amount == null
    ? "Costo aún no verificable"
    : `Costo financiero total ${formatMoney(amount, plan.anchors.currency)}`;
}

/** Adapter exacto del snapshot OpenAPI publicado en qavante-api#306. */
export function operationPlanViewFromRead(
  response: OperationPlanRead,
  canRequestApproval: boolean,
): OperationPlanView {
  const selection = response.selection;
  const plan = response.operation_plan;
  if (!plan) {
    if (
      selection &&
      (!selection.operation_required ||
        selection.alternative_code === "no_action" ||
        selection.alternative_family === "no_action")
    ) {
      return noActionOperationPlanView();
    }
    return response.abstain_reasons && response.abstain_reasons.length > 0
      ? abstainOperationPlanView(response.abstain_reasons)
      : operationPlanNotInformedView();
  }

  const evidenceRefs = plan.cost?.evidence_refs ?? [];
  const checklist: OperationPlanChecklistItemView[] = [
    ...(plan.checklist.required_terms ?? []).map((term, index) => ({
      id: `term-${index}`,
      label: term,
      state: "unknown" as const,
      detail: "No hay una evaluación de cumplimiento disponible.",
    })),
    ...(plan.checklist.required_evidence ?? []).map((evidence, index) => ({
      id: `evidence-${index}`,
      label: evidence,
      state: "unknown" as const,
      detail: "No hay una evaluación de cumplimiento disponible.",
    })),
  ];
  const validity = plan.configuration?.effective_until;

  return {
    kind: "present",
    planId: plan.id,
    status: plan.current_status,
    ...operationPlanStatusView(plan.current_status),
    alternativeTitle: selection
      ? readAlternativeTitle(selection.alternative_code, selection.alternative_family)
      : "Alternativa no informada",
    selectionRationale: selection?.rationale ?? null,
    selectedAtLabel: selection ? formatDateLike(selection.selected_at) : null,
    costLabel: readCostLabel(plan),
    evidenceLabel:
      evidenceRefs.length > 0
        ? `${evidenceRefs.length} evidencia${evidenceRefs.length === 1 ? "" : "s"} verificable${evidenceRefs.length === 1 ? "" : "s"}`
        : "Evidencia no informada",
    validityLabel: validity ? `Vigente hasta ${formatDateLike(validity)}` : "Vigencia no informada",
    checklist,
    checklistCompletionStatus: plan.checklist.completion_status,
    canRequestApproval:
      canRequestApproval && plan.current_status === "draft" && evidenceRefs.length > 0,
    approvalEvidenceRefs: evidenceRefs,
    errors: (plan.errors ?? []).map((error) => ({
      id: error.event_id,
      label:
        error.status === "rejected_by_provider"
          ? "Rechazado por proveedor"
          : error.status === "cancelled"
            ? "Cancelado"
            : "Vencido",
      detail:
        error.status === "rejected_by_provider"
          ? "El proveedor rechazó la operación."
          : error.status === "cancelled"
            ? "La operación fue cancelada."
            : "La vigencia de la operación terminó.",
    })),
  };
}

export type OperationPlanErrorPhase = "read" | "request_approval";

export function operationPlanErrorMessage(
  error: unknown,
  phase: OperationPlanErrorPhase = "read",
): string {
  const action = phase === "read" ? "leer el plan operativo" : "solicitar la aprobación";
  if (!(error instanceof ApiError)) return `No pudimos ${action}. Reintenta.`;
  if (error.status === 401) return "Tu sesión venció. Vuelve a iniciar sesión.";
  if (error.status === 403) return "Tu rol no está autorizado para ver o solicitar este plan.";
  if (error.status === 404) return "El plan ya no está disponible. Actualiza Hoy.";
  if (error.status === 409) return "El estado del plan cambió. Actualiza Hoy antes de continuar.";
  if (error.status === 412) {
    return "El plan no cumple una condición vigente. Revisa el checklist y actualiza Hoy.";
  }
  if (error.status === 422) {
    return "La solicitud no coincide con el plan vigente. Actualiza Hoy y revisa sus datos.";
  }
  if (error.isNetworkError()) {
    return `No pudimos confirmar si se alcanzó a ${action}. Actualiza Hoy antes de reintentar.`;
  }
  return `No pudimos ${action}. Reintenta.`;
}
