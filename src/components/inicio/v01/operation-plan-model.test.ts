import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type {
  DecisionSelectionResponse,
  LiquidityEvaluation,
  OperationPlanRead,
} from "@/lib/api/financial-decisions";
import {
  abstainOperationPlanView,
  noActionOperationPlanView,
  operationPlanErrorMessage,
  operationPlanStatusView,
  operationPlanViewFromRead,
  operationPlanViewFromSelection,
} from "./operation-plan-model";

const NOW = new Date("2026-09-01T12:00:00Z");

function evaluation(): LiquidityEvaluation {
  return {
    decision_id: "10000000-0000-4000-8000-000000000001",
    status: "evaluated",
    decision_support: "eligible",
    model_version: "fpde-f1",
    recommended_alternative_id: "30000000-0000-4000-8000-000000000001",
    scope: {
      legal_entity_id: "20000000-0000-4000-8000-000000000001",
      currency: "CLP",
      as_of: "2026-09-01T09:00:00Z",
      horizon_days: 90,
      valid_until: "2026-09-03T09:00:00Z",
    },
    situation: {},
    event: {},
    alternatives: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        code: "credit_line:quote-1",
        family: "credit_line",
        rank: 1,
        is_no_action: false,
        is_rejected: false,
        explanation: {},
        parameters: {},
        simulation: {},
        comparison: {},
        cost_status: "known",
        cost: {
          status: "known",
          total_financial_cost: "250000",
          contract_version: "cost.v1",
          evidence_refs: ["quote:1"],
        },
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        code: "no_action",
        family: "no_action",
        rank: 2,
        is_no_action: true,
        is_rejected: false,
        explanation: {},
        parameters: {},
        simulation: {},
        comparison: {},
        cost_status: "not_applicable",
      },
    ],
  };
}

function selection(over: Partial<DecisionSelectionResponse> = {}): DecisionSelectionResponse {
  return {
    selection_id: "40000000-0000-4000-8000-000000000001",
    decision_id: evaluation().decision_id,
    alternative_id: evaluation().alternatives[0]!.id,
    operation_required: true,
    operation_plan_id: "50000000-0000-4000-8000-000000000001",
    operation_status: "draft",
    replayed: false,
    ...over,
  };
}

function read(over: Partial<OperationPlanRead> = {}): OperationPlanRead {
  return {
    lookup: "decision_id",
    tenant_id: "00000000-0000-4000-8000-000000000001",
    decision_id: evaluation().decision_id,
    decision_as_of: "2026-09-01T09:00:00Z",
    selection: {
      id: "40000000-0000-4000-8000-000000000001",
      alternative_id: evaluation().alternatives[0]!.id,
      alternative_code: "credit_line:quote-1",
      alternative_family: "credit_line",
      selected_by_user_id: "00000000-0000-4000-8000-000000000002",
      selected_at: "2026-09-01T09:05:00Z",
      rationale: "Protege la caja",
      operation_required: true,
    },
    operation_plan: {
      id: "50000000-0000-4000-8000-000000000001",
      current_status: "draft",
      status_source: "operation_events",
      created_at: "2026-09-01T09:05:00Z",
      created_by_ref: "selection:40000000-0000-4000-8000-000000000001",
      anchors: {
        legal_entity_id: "20000000-0000-4000-8000-000000000001",
        currency: "CLP",
      },
      approval_policy: {
        ref: "policy:v0",
        support: "unsupported",
        reason: "approval_policy_not_ratified",
      },
      operational_owner_ref: "owner:tenant",
      configuration: {
        id: "60000000-0000-4000-8000-000000000001",
        version: "1",
        enabled: true,
        source_mode: "internal_record",
        effective_from: "2026-09-01T00:00:00Z",
        effective_until: "2026-09-03T00:00:00Z",
      },
      cost: {
        id: "70000000-0000-4000-8000-000000000001",
        as_of: "2026-09-01T09:00:00Z",
        start_date: "2026-09-01",
        end_date: "2026-10-01",
        day_count_convention: "actual/365",
        principal_or_gross_amount: "10000000",
        status: "known",
        total_financial_cost: "250000",
        rounding_rule: "half_up",
        contract_version: "cost.v1",
        evidence_refs: ["quote:1"],
      },
      checklist: {
        completion_status: "not_evaluated",
        required_terms: ["Términos vigentes"],
        required_evidence: ["Cotización anclada"],
      },
    },
    ...over,
  };
}

describe("OperationPlan view-model F2", () => {
  it("adapta sólo el draft contractual de selección y deja checklist/solicitud fail-closed", () => {
    const view = operationPlanViewFromSelection(evaluation(), selection(), NOW);

    expect(view).toMatchObject({
      kind: "present",
      status: "draft",
      statusLabel: "Borrador",
      alternativeTitle: "Usar línea de crédito",
      costLabel: "Costo financiero total $250.000",
      evidenceLabel: "1 evidencia verificable",
      validityLabel: "Vigente hasta 03-09-2026",
      checklist: [],
      checklistCompletionStatus: null,
      canRequestApproval: false,
    });
  });

  it("representa no_action con plan null como ausencia explícita", () => {
    const view = operationPlanViewFromSelection(
      evaluation(),
      selection({
        alternative_id: evaluation().alternatives[1]!.id,
        operation_required: false,
        operation_plan_id: null,
        operation_status: null,
      }),
      NOW,
    );

    expect(view).toEqual(noActionOperationPlanView());
    expect(view).toMatchObject({ kind: "absent", reason: "no_action" });
  });

  it("adapta el reader OpenAPI sin inferir completitud del checklist", () => {
    const view = operationPlanViewFromRead(read(), true);

    expect(view).toMatchObject({
      kind: "present",
      status: "draft",
      costLabel: "Costo financiero total $250.000",
      evidenceLabel: "1 evidencia verificable",
      validityLabel: "Vigente hasta 03-09-2026",
      checklistCompletionStatus: "not_evaluated",
      canRequestApproval: true,
      approvalEvidenceRefs: ["quote:1"],
    });
    if (view.kind === "present") {
      expect(view.checklist).toHaveLength(2);
      expect(view.checklist.every((item) => item.state === "unknown")).toBe(true);
    }
  });

  it("transporta not_evaluated aunque las listas del checklist estén ausentes", () => {
    const base = read();
    const view = operationPlanViewFromRead(
      read({
        operation_plan: {
          ...base.operation_plan!,
          checklist: { completion_status: "not_evaluated" },
        },
      }),
      true,
    );

    expect(view).toMatchObject({
      kind: "present",
      checklistCompletionStatus: "not_evaluated",
      checklist: [],
    });
  });

  it("mantiene costo unknown y solicitud fail-closed sin evidencia", () => {
    const base = read();
    const view = operationPlanViewFromRead(
      read({
        operation_plan: {
          ...base.operation_plan!,
          cost: { ...base.operation_plan!.cost!, status: "unknown", evidence_refs: [] },
        },
      }),
      true,
    );

    expect(view).toMatchObject({
      kind: "present",
      costLabel: "Costo aún no verificable",
      evidenceLabel: "Evidencia no informada",
      canRequestApproval: false,
    });
  });

  it("distingue no_action, abstención con causas exactas y ausencia sin causa", () => {
    const base = read();
    expect(
      operationPlanViewFromRead(
        read({
          operation_plan: null,
          abstain_reasons: ["esta-causa-no-debe-reemplazar-no_action"],
          selection: {
            ...base.selection!,
            alternative_code: "no_action",
            alternative_family: "no_action",
            operation_required: false,
          },
        }),
        true,
      ),
    ).toMatchObject({ kind: "absent", reason: "no_action" });

    const explicit = operationPlanViewFromRead(
      read({
        operation_plan: null,
        selection: null,
        abstain_reasons: ["approval_policy_not_ratified", "missing_configuration"],
      }),
      true,
    );
    expect(explicit).toMatchObject({
      kind: "absent",
      reason: "abstain",
      reasons: ["approval_policy_not_ratified", "missing_configuration"],
      description: "Qavante informó una abstención para esta decisión.",
    });

    const missing = operationPlanViewFromRead(
      read({ operation_plan: null, selection: null, abstain_reasons: [] }),
      true,
    );
    expect(missing).toMatchObject({
      kind: "absent",
      reason: "not_informed",
      reasons: [],
    });
    if (missing.kind !== "absent") throw new Error("expected absent OperationPlan view");
    expect(missing.description).toContain("No inferimos el motivo");
    expect(missing.description).not.toContain("evidencia");
  });

  it("mantiene awaiting_approval y errores del ledger sólo lectura", () => {
    const base = read();
    const view = operationPlanViewFromRead(
      read({
        operation_plan: {
          ...base.operation_plan!,
          current_status: "awaiting_approval",
          errors: [
            {
              event_id: "80000000-0000-4000-8000-000000000001",
              status: "expired",
              occurred_at: "2026-09-03T00:00:00Z",
              reason: "terms_expired",
            },
          ],
        },
      }),
      true,
    );

    expect(view).toMatchObject({
      kind: "present",
      statusLabel: "Esperando aprobación",
      readOnly: true,
      canRequestApproval: false,
      errors: [{ label: "Vencido", detail: "terms_expired" }],
    });
  });

  it("no fabrica un plan si el resultado es inconsistente o pertenece a otra decisión", () => {
    expect(
      operationPlanViewFromSelection(
        evaluation(),
        selection({ operation_required: true, operation_plan_id: null }),
        NOW,
      ),
    ).toBeNull();
    expect(
      operationPlanViewFromSelection(
        evaluation(),
        selection({ decision_id: "otra-decision" }),
        NOW,
      ),
    ).toBeNull();
  });

  it("distingue draft y awaiting_approval; cualquier otro estado queda sólo lectura", () => {
    expect(operationPlanStatusView("draft")).toMatchObject({ readOnly: false });
    expect(operationPlanStatusView("awaiting_approval")).toMatchObject({
      statusLabel: "Esperando aprobación",
      readOnly: true,
    });
    expect(operationPlanStatusView("submitted")).toMatchObject({
      statusLabel: "Estado informado",
      readOnly: true,
    });
  });

  it("mantiene abstención distinta de no_action", () => {
    expect(abstainOperationPlanView(["reason"])).toMatchObject({
      kind: "absent",
      reason: "abstain",
      reasons: ["reason"],
    });
    expect(abstainOperationPlanView(["reason"])).not.toEqual(noActionOperationPlanView());
  });

  it.each([
    [401, "sesión venció"],
    [403, "rol no está autorizado"],
    [404, "ya no está disponible"],
    [409, "estado del plan cambió"],
    [412, "no cumple una condición vigente"],
    [422, "no coincide con el plan vigente"],
  ])("explica el error HTTP %i sin éxito implícito", (status, expected) => {
    expect(operationPlanErrorMessage(new ApiError("backend", status))).toContain(expected);
  });

  it("ante red incierta pide actualizar antes de reintentar", () => {
    expect(operationPlanErrorMessage(new ApiError("network", 0), "request_approval")).toBe(
      "No pudimos confirmar si se alcanzó a solicitar la aprobación. Actualiza Hoy antes de reintentar.",
    );
  });
});
