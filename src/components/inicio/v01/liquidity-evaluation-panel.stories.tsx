import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HttpResponse, http } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type {
  DecisionSelectionRequest,
  DecisionSelectionResponse,
  LiquidityEvaluation,
  OperationApprovalRequest,
  OperationPlanRead,
} from "@/lib/api/financial-decisions";
import { LiquidityEvaluationPanel } from "./liquidity-evaluation-panel";

const LINE_ID = "30000000-0000-4000-8000-000000000001";
const FACTORING_ID = "30000000-0000-4000-8000-000000000002";
const NO_ACTION_ID = "30000000-0000-4000-8000-000000000003";
const RETRY_DECISION_ID = "10000000-0000-4000-8000-000000000011";
const CHANGE_INTENT_DECISION_ID = "10000000-0000-4000-8000-000000000012";
const NO_ACTION_DECISION_ID = "10000000-0000-4000-8000-000000000013";
const REPLAY_DECISION_ID = "10000000-0000-4000-8000-000000000014";
const ERROR_401_DECISION_ID = "10000000-0000-4000-8000-000000000021";
const ERROR_403_DECISION_ID = "10000000-0000-4000-8000-000000000022";
const ERROR_422_DECISION_ID = "10000000-0000-4000-8000-000000000024";

const EVALUATION: LiquidityEvaluation = {
  decision_id: "10000000-0000-4000-8000-000000000001",
  status: "evaluated",
  decision_support: "eligible",
  model_version: "fpde-f1",
  recommended_alternative_id: LINE_ID,
  scope: {
    legal_entity_id: "20000000-0000-4000-8000-000000000001",
    currency: "CLP",
    as_of: "2026-08-31T09:00:00Z",
    horizon_days: 90,
    valid_until: "2026-09-01T09:00:00Z",
  },
  situation: {},
  event: {
    amount_peak: "10000000",
    baseline_min_cash: "-8000000",
    recovery_date: "2026-09-20",
  },
  alternatives: [
    {
      id: LINE_ID,
      code: "credit_line:quote-1",
      family: "credit_line",
      rank: 1,
      is_no_action: false,
      is_rejected: false,
      explanation: { summary: "Cubre la brecha con términos vigentes." },
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
      id: FACTORING_ID,
      code: "factoring:invoice-1",
      family: "factoring",
      rank: 2,
      is_no_action: false,
      is_rejected: false,
      explanation: {},
      parameters: {},
      simulation: {},
      comparison: {},
      cost_status: "unknown",
    },
    {
      id: NO_ACTION_ID,
      code: "no_action",
      family: "no_action",
      rank: 3,
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

const meta = {
  title: "Rediseño F2 / V01 Hoy / Evaluación de liquidez",
  component: LiquidityEvaluationPanel,
  parameters: {
    layout: "padded",
    a11y: { test: "error" },
    msw: { handlers: [storySelectionHandler(), requestApprovalHandler()] },
  },
  args: { evaluation: EVALUATION, now: new Date("2026-08-31T12:00:00Z") },
} satisfies Meta<typeof LiquidityEvaluationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

function selectionResponse(
  over: Partial<DecisionSelectionResponse> = {},
): DecisionSelectionResponse {
  return {
    selection_id: "40000000-0000-4000-8000-000000000001",
    decision_id: EVALUATION.decision_id,
    alternative_id: LINE_ID,
    operation_required: true,
    operation_plan_id: "50000000-0000-4000-8000-000000000001",
    operation_status: "draft",
    replayed: false,
    ...over,
  };
}

function evaluationForStory(decisionId: string): LiquidityEvaluation {
  return { ...EVALUATION, decision_id: decisionId };
}

/* Las play functions de Storybook comparten un worker. Un único router estable,
   con IDs de decisión exclusivos por story, evita que una story reemplace el
   handler de otra mientras ambas están interactuando. */
function storySelectionHandler() {
  return http.post(
    "*/api/treasury/decisions/:decisionId/selection",
    async ({ params, request }) => {
      const decisionId = String(params.decisionId);
      const body = (await request.json()) as DecisionSelectionRequest;

      if (decisionId === RETRY_DECISION_ID) {
        retryBodies.push(body);
        return retryBodies.length === 1
          ? HttpResponse.error()
          : HttpResponse.json(selectionResponse({ decision_id: decisionId }));
      }
      if (decisionId === CHANGE_INTENT_DECISION_ID) {
        changedIntentBodies.push(body);
        return changedIntentBodies.length === 1
          ? HttpResponse.error()
          : HttpResponse.json(selectionResponse({ decision_id: decisionId }));
      }
      if (decisionId === NO_ACTION_DECISION_ID) {
        noActionBodies.push(body);
        return HttpResponse.json(
          selectionResponse({
            decision_id: decisionId,
            alternative_id: NO_ACTION_ID,
            operation_required: false,
            operation_plan_id: null,
            operation_status: null,
          }),
        );
      }
      if (decisionId === REPLAY_DECISION_ID) {
        return HttpResponse.json(selectionResponse({ decision_id: decisionId, replayed: true }));
      }

      const errors: Record<string, 401 | 403 | 409 | 422> = {
        [ERROR_401_DECISION_ID]: 401,
        [ERROR_403_DECISION_ID]: 403,
        [ERROR_422_DECISION_ID]: 422,
      };
      const status = errors[decisionId];
      if (status) {
        errorRequests[status]?.push(body);
        return HttpResponse.json(
          { detail: { code: "selection_rejected", detail: "rejected" } },
          { status },
        );
      }

      return HttpResponse.json(selectionResponse({ decision_id: decisionId }));
    },
  );
}

function requestApprovalHandler() {
  return http.post(
    "*/api/treasury/operation-plans/:operationPlanId/request-approval",
    async ({ request }) => {
      approvalBodies.push((await request.json()) as OperationApprovalRequest);
      return HttpResponse.json({
        operation_plan_id: OPERATION_PLAN.operation_plan!.id,
        event_id: "80000000-0000-4000-8000-000000000001",
        from_status: "draft",
        to_status: "awaiting_approval",
        occurred_at: "2026-08-31T12:10:00Z",
        replayed: false,
      });
    },
  );
}

const OPERATION_PLAN: OperationPlanRead = {
  lookup: "decision_id",
  tenant_id: "00000000-0000-4000-8000-000000000001",
  decision_id: EVALUATION.decision_id,
  decision_as_of: "2026-08-31T09:00:00Z",
  selection: {
    id: "40000000-0000-4000-8000-000000000001",
    alternative_id: LINE_ID,
    alternative_code: "credit_line:quote-1",
    alternative_family: "credit_line",
    selected_by_user_id: "00000000-0000-4000-8000-000000000002",
    selected_at: "2026-08-31T09:05:00Z",
    rationale: "Protege la caja",
    operation_required: true,
  },
  operation_plan: {
    id: "50000000-0000-4000-8000-000000000001",
    current_status: "draft",
    status_source: "operation_events",
    created_at: "2026-08-31T09:05:00Z",
    created_by_ref: "selection:40000000-0000-4000-8000-000000000001",
    anchors: {
      legal_entity_id: EVALUATION.scope.legal_entity_id,
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
      effective_from: "2026-08-31T00:00:00Z",
      effective_until: "2026-09-01T09:00:00Z",
    },
    cost: {
      id: "70000000-0000-4000-8000-000000000001",
      as_of: "2026-08-31T09:00:00Z",
      start_date: "2026-08-31",
      end_date: "2026-09-30",
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
};

async function openSelection(canvasElement: HTMLElement, alternative: string, rationale: string) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: `Elegir ${alternative}` }));
  const alternativeId =
    alternative === "No financiar"
      ? NO_ACTION_ID
      : alternative === "Factorizar factura completa"
        ? FACTORING_ID
        : LINE_ID;
  /* Base UI conserva portales `data-closed` durante su salida. El role global puede capturar
     uno residual de la story anterior; el contrato de esta prueba es el popup de ESTA
     alternativa que ya está `data-open`. */
  const dialog = await waitFor(() => {
    const active = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[role="dialog"][data-selection-dialog="${alternativeId}"][data-open]`,
      ),
    );
    expect(active).toHaveLength(1);
    return active[0]!;
  });
  const input = within(dialog).getByLabelText("Motivo de tu decisión");
  await userEvent.type(input, rationale);
  return { canvas, dialog, input };
}

async function submit(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar selección" }));
}

async function closeDialog(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(dialog).not.toHaveAttribute("data-open"));
}

const errorRequests: Partial<Record<401 | 403 | 409 | 422, DecisionSelectionRequest[]>> = {};

async function expectErrorWithoutSuccess(
  canvasElement: HTMLElement,
  status: 401 | 403 | 409 | 422,
  expected: RegExp,
) {
  errorRequests[status] = [];
  const { canvas, dialog } = await openSelection(
    canvasElement,
    "Usar línea de crédito",
    "Motivo verificable",
  );
  await submit(dialog);
  await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent(expected));
  await expect(errorRequests[status]).toHaveLength(1);
  await expect(errorRequests[status]?.[0]).toMatchObject({
    alternative_id: LINE_ID,
    rationale: "Motivo verificable",
  });
  await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  await closeDialog(dialog);
}

export const Comparable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Alternativas para proteger tu caja" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("1. Usar línea de crédito")).toBeInTheDocument();
    await expect(canvas.getByText("2. Factorizar factura completa")).toBeInTheDocument();
    await expect(canvas.getByText("3. No financiar")).toBeInTheDocument();
    await expect(canvas.getByText("Costo financiero total $250.000")).toBeInTheDocument();
    await expect(canvas.getByText("Costo aún no verificable")).toBeInTheDocument();
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const Cargando: Story = {
  args: { evaluation: null, loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Evaluación de liquidez" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Buscando una evaluación financiera vigente",
    );
  },
};

export const ErrorDeLectura: Story = {
  args: { evaluation: null, failed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "No pudimos leer la evaluación financiera",
    );
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
  },
};

let approvalBodies: OperationApprovalRequest[] = [];

export const OperationPlanYSolicitudAprobacion: Story = {
  args: { canSelect: true, operationPlanRead: OPERATION_PLAN },
  play: async ({ canvasElement }) => {
    approvalBodies = [];
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Usar línea de crédito" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Borrador")).toBeInTheDocument();
    await expect(canvas.getByText("Cumplimiento no evaluado")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Solicitar aprobación" }));
    const dialog = await waitFor(() => {
      const active = document.querySelector<HTMLElement>(
        `[role="dialog"][data-operation-plan-approval="${OPERATION_PLAN.operation_plan!.id}"][data-open]`,
      );
      expect(active).not.toBeNull();
      return active!;
    });
    await expect(within(dialog).getByText(/no lo aprueba.*ni mueve dinero/i)).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByLabelText("Motivo de la solicitud"),
      "Solicito revisión con evidencia anclada",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar solicitud" }));
    await expect(await canvas.findByText("Esperando aprobación")).toBeInTheDocument();
    await expect(canvas.getByText("Sólo lectura")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /aprobar/i })).not.toBeInTheDocument();
    await expect(approvalBodies).toHaveLength(1);
    await expect(approvalBodies[0]).toMatchObject({
      evidence_refs: ["quote:1"],
      rationale: "Solicito revisión con evidencia anclada",
    });
  },
};

export const ChecklistVacioPermaneceNoEvaluado: Story = {
  args: {
    canSelect: true,
    operationPlanRead: {
      ...OPERATION_PLAN,
      operation_plan: {
        ...OPERATION_PLAN.operation_plan!,
        checklist: { completion_status: "not_evaluated" },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cumplimiento no evaluado")).toBeInTheDocument();
    await expect(canvas.getByText("No se informaron requisitos.")).toBeInTheDocument();
    await expect(canvas.queryByText(/0 de 0 completos/i)).not.toBeInTheDocument();
  },
};

export const PlanNuloConCausasExactas: Story = {
  args: {
    operationPlanRead: {
      ...OPERATION_PLAN,
      selection: null,
      operation_plan: null,
      abstain_reasons: ["approval_policy_not_ratified", "missing_configuration"],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No hay plan operativo")).toBeInTheDocument();
    const reasons = canvas.getByRole("list", { name: "Causas informadas por Qavante" });
    await expect(within(reasons).getByText("approval_policy_not_ratified")).toBeInTheDocument();
    await expect(within(reasons).getByText("missing_configuration")).toBeInTheDocument();
    await expect(canvas.queryByText(/evidencia no permite/i)).not.toBeInTheDocument();
  },
};

export const PlanNuloSinCausaEsNeutral: Story = {
  args: {
    operationPlanRead: {
      ...OPERATION_PLAN,
      selection: null,
      operation_plan: null,
      abstain_reasons: [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Plan operativo no informado")).toBeInTheDocument();
    await expect(canvas.getByText(/No inferimos el motivo/)).toBeInTheDocument();
    await expect(canvas.queryByText(/evidencia no permite/i)).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("list", { name: "Causas informadas por Qavante" }),
    ).not.toBeInTheDocument();
  },
};

export const SeleccionOwner: Story = {
  args: { canSelect: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Elegir Usar línea de crédito" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Elegir Factorizar factura completa" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Elegir No financiar" })).toBeInTheDocument();
    const { dialog } = await openSelection(
      canvasElement,
      "Usar línea de crédito",
      "Motivo de prueba",
    );
    await expect(within(dialog).getByText("Elegir Usar línea de crédito")).toBeInTheDocument();
    await expect(
      within(dialog).getByText(/no solicita ni ejecuta financiamiento/i),
    ).toBeInTheDocument();
    await closeDialog(dialog);
  },
};

let retryBodies: DecisionSelectionRequest[] = [];

/** Monta directamente V01 para el test de browser; no cambia `hoyV01` en producción. */
export const RetryIdempotenteYExito: Story = {
  args: { canSelect: true, evaluation: evaluationForStory(RETRY_DECISION_ID) },
  play: async ({ canvasElement }) => {
    retryBodies = [];
    const { canvas, dialog } = await openSelection(
      canvasElement,
      "Usar línea de crédito",
      "Protege el vencimiento con términos verificados",
    );

    await submit(dialog);
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        /No pudimos confirmar si la selección se registró/,
      ),
    );
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();

    await submit(dialog);
    const status = await canvas.findByRole("status");
    await expect(status).toHaveTextContent(/plan operativo en borrador/i);
    await expect(status).toHaveTextContent(/estado draft/i);
    await expect(document.activeElement).toBe(status);
    await expect(retryBodies).toHaveLength(2);
    await expect(retryBodies[0]).toEqual({
      alternative_id: LINE_ID,
      idempotency_key: retryBodies[0]?.idempotency_key,
      rationale: "Protege el vencimiento con términos verificados",
    });
    await expect(retryBodies[1]?.idempotency_key).toBe(retryBodies[0]?.idempotency_key);
  },
};

let changedIntentBodies: DecisionSelectionRequest[] = [];

export const MotivoCambiadoUsaNuevaKey: Story = {
  args: { canSelect: true, evaluation: evaluationForStory(CHANGE_INTENT_DECISION_ID) },
  play: async ({ canvasElement }) => {
    changedIntentBodies = [];
    const { canvas, dialog, input } = await openSelection(
      canvasElement,
      "Usar línea de crédito",
      "Primer motivo",
    );
    await submit(dialog);
    await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());

    await userEvent.clear(input);
    await userEvent.type(input, "Motivo corregido");
    await submit(dialog);
    await canvas.findByRole("status");
    await expect(changedIntentBodies).toHaveLength(2);
    await expect(changedIntentBodies[1]?.rationale).toBe("Motivo corregido");
    await expect(changedIntentBodies[1]?.idempotency_key).not.toBe(
      changedIntentBodies[0]?.idempotency_key,
    );
  },
};

let noActionBodies: DecisionSelectionRequest[] = [];

export const NoActionSinPlan: Story = {
  args: { canSelect: true, evaluation: evaluationForStory(NO_ACTION_DECISION_ID) },
  play: async ({ canvasElement }) => {
    noActionBodies = [];
    const { canvas, dialog } = await openSelection(
      canvasElement,
      "No financiar",
      "La caja se recupera sin financiamiento",
    );
    await submit(dialog);
    await waitFor(() => expect(noActionBodies).toHaveLength(1));
    const status = await canvas.findByRole("status");
    await expect(status).toHaveTextContent(/No requiere un plan operativo/i);
    await expect(status).toHaveTextContent(/sin OperationPlan/i);
    await expect(noActionBodies[0]?.alternative_id).toBe(NO_ACTION_ID);
  },
};

export const ReplayNoDuplica: Story = {
  args: { canSelect: true, evaluation: evaluationForStory(REPLAY_DECISION_ID) },
  play: async ({ canvasElement }) => {
    const { canvas, dialog } = await openSelection(
      canvasElement,
      "Usar línea de crédito",
      "Mismo intento anterior",
    );
    await submit(dialog);
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "Esta misma selección ya estaba registrada.",
    );
  },
};

export const Error401NoConfirma: Story = {
  args: { canSelect: true, evaluation: evaluationForStory(ERROR_401_DECISION_ID) },
  play: ({ canvasElement }) => expectErrorWithoutSuccess(canvasElement, 401, /sesión venció/i),
};

export const Error403NoConfirma: Story = {
  args: { canSelect: true, evaluation: evaluationForStory(ERROR_403_DECISION_ID) },
  play: ({ canvasElement }) =>
    expectErrorWithoutSuccess(canvasElement, 403, /rol no está autorizado/i),
};

export const Error422NoConfirma: Story = {
  args: { canSelect: true, evaluation: evaluationForStory(ERROR_422_DECISION_ID) },
  play: ({ canvasElement }) => expectErrorWithoutSuccess(canvasElement, 422, /ya no cumple/i),
};

export const Abstencion: Story = {
  args: { evaluation: { ...EVALUATION, decision_support: "abstain" }, canSelect: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Qavante se abstuvo de recomendar")).toBeInTheDocument();
    await expect(canvas.getByText(/No se asumieron tasas, costos ni montos/)).toBeInTheDocument();
    await expect(canvas.queryByText("Mejor alternativa evaluada")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /^Elegir / })).not.toBeInTheDocument();
  },
};

export const SinEvaluacion: Story = {
  args: { evaluation: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Aún no hay una evaluación de liquidez persistida"),
    ).toBeInTheDocument();
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
  },
};

export const Vencida: Story = {
  args: {
    canSelect: true,
    evaluation: {
      ...EVALUATION,
      scope: { ...EVALUATION.scope, valid_until: "2026-08-30T09:00:00Z" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Evaluación sin recomendación vigente" }),
    ).toBeInTheDocument();
    await expect(canvas.queryByText("Mejor alternativa evaluada")).not.toBeInTheDocument();
    await expect(canvas.getByText(/no usar para decidir/i)).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /^Elegir / })).not.toBeInTheDocument();
  },
};
