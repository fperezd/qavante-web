import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { QavanteButton } from "@/components/qavante";
import {
  abstainOperationPlanView,
  noActionOperationPlanView,
  operationPlanNotInformedView,
  operationPlanStatusView,
  type OperationPlanPresentView,
} from "./operation-plan-model";
import { OperationPlanPanel } from "./operation-plan-panel";

const BASE: OperationPlanPresentView = {
  kind: "present",
  planId: "50000000-0000-4000-8000-000000000001",
  status: "draft",
  ...operationPlanStatusView("draft"),
  alternativeTitle: "Usar línea de crédito",
  selectionRationale: "Protege la caja con términos vigentes.",
  selectedAtLabel: "01-09-2026",
  costLabel: "Costo financiero total $250.000",
  evidenceLabel: "2 evidencias verificables",
  validityLabel: "Vigente hasta 03-09-2026",
  checklistCompletionStatus: "not_evaluated",
  checklist: [
    {
      id: "terms",
      label: "Términos vigentes",
      state: "unknown",
      detail: "Cumplimiento no evaluado por el backend.",
    },
    {
      id: "evidence",
      label: "Evidencia anclada",
      state: "unknown",
      detail: "Cumplimiento no evaluado por el backend.",
    },
  ],
  canRequestApproval: true,
  approvalEvidenceRefs: ["quote:1", "terms:1"],
  errors: [],
};

const meta = {
  title: "Inicio/V01/OperationPlanPanel",
  component: OperationPlanPanel,
  parameters: { layout: "padded", a11y: { test: "error" } },
  tags: ["autodocs"],
  args: { plan: BASE },
} satisfies Meta<typeof OperationPlanPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const requestApproval = fn();

export const DraftConRequisitosNoEvaluados: Story = {
  args: {
    requestApprovalControl: (
      <QavanteButton size="sm" onClick={requestApproval}>
        Solicitar aprobación
      </QavanteButton>
    ),
  },
  play: async ({ canvasElement }) => {
    requestApproval.mockClear();
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Borrador")).toBeInTheDocument();
    await expect(canvas.getByText("Cumplimiento no evaluado")).toBeInTheDocument();
    await expect(
      canvas.getByText(/cumplimiento del checklist no fue evaluado/i),
    ).toBeInTheDocument();
    const button = canvas.getByRole("button", { name: "Solicitar aprobación" });
    await expect(button).toBeEnabled();
    await userEvent.click(button);
    await expect(requestApproval).toHaveBeenCalledOnce();
  },
};

export const DraftChecklistVacioNoEvaluado: Story = {
  args: {
    plan: {
      ...BASE,
      checklist: [],
    },
    requestApprovalControl: (
      <QavanteButton size="sm" onClick={requestApproval}>
        Solicitar aprobación
      </QavanteButton>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cumplimiento no evaluado")).toBeInTheDocument();
    await expect(canvas.getByText("No se informaron requisitos.")).toBeInTheDocument();
    await expect(canvas.queryByText(/0 de 0 completos/i)).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Solicitar aprobación" })).toBeEnabled();
  },
};

export const DraftChecklistAunNoInformado: Story = {
  args: {
    plan: {
      ...BASE,
      checklistCompletionStatus: null,
      checklist: [],
      canRequestApproval: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Estado no informado")).toBeInTheDocument();
    await expect(canvas.getByText(/No solicitaremos aprobación/)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Solicitar aprobación" })).toBeDisabled();
  },
};

export const AwaitingApprovalSoloLectura: Story = {
  args: {
    plan: {
      ...BASE,
      status: "awaiting_approval",
      ...operationPlanStatusView("awaiting_approval"),
      canRequestApproval: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Esperando aprobación")).toBeInTheDocument();
    await expect(canvas.getByText("Sólo lectura")).toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Solicitar aprobación" }),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /aprobar/i })).not.toBeInTheDocument();
  },
};

/**
 * El estado aprobado viene del ledger de Qavante. Esta superficie sólo lo explica:
 * no habilita una acción externa ni presume que hubo una cotización o desembolso.
 */
export const AprobadoSoloLectura: Story = {
  args: {
    plan: {
      ...BASE,
      status: "approved",
      ...operationPlanStatusView("approved"),
      canRequestApproval: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Aprobado")).toBeInTheDocument();
    await expect(canvas.getByText("Sólo lectura")).toBeInTheDocument();
    await expect(canvas.getByText(/estado fue informado por Qavante/i)).toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: /solicitar aprobación/i }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: /cotizar|enviar|ejecutar/i }),
    ).not.toBeInTheDocument();
  },
};

export const OtroEstadoEsSoloLectura: Story = {
  args: {
    plan: {
      ...BASE,
      status: "submitted",
      ...operationPlanStatusView("submitted"),
      canRequestApproval: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Enviado")).toBeInTheDocument();
    await expect(
      canvas.getByText("El plan fue enviado y está a la espera de procesamiento."),
    ).toBeInTheDocument();
    // El código interno del estado no se publica: se presenta su etiqueta, no «submitted».
    await expect(canvas.queryByText(/submitted/)).not.toBeInTheDocument();
    await expect(canvas.getByText("Sólo lectura")).toBeInTheDocument();
  },
};

export const NoActionSinPlan: Story = {
  args: { plan: noActionOperationPlanView() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No financiar no crea un plan operativo")).toBeInTheDocument();
    await expect(
      canvas.getByText(/No hay solicitud, aprobación ni movimiento de dinero/),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const AbstencionSinPlan: Story = {
  args: { plan: abstainOperationPlanView(["approval_policy_not_ratified"]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No hay plan operativo")).toBeInTheDocument();
    await expect(
      canvas.getByText("Qavante informó una abstención para esta decisión."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("approval_policy_not_ratified")).toBeInTheDocument();
  },
};

export const SinPlanSinCausaInformada: Story = {
  args: { plan: operationPlanNotInformedView() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Plan operativo no informado")).toBeInTheDocument();
    await expect(canvas.getByText(/No inferimos el motivo/)).toBeInTheDocument();
    await expect(canvas.queryByText(/evidencia no permite/i)).not.toBeInTheDocument();
  },
};

export const ErrorPrecondicion: Story = {
  args: {
    errorMessage: "El plan no cumple una condición vigente. Revisa el checklist y actualiza Hoy.",
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(/no cumple una condición vigente/i);
    await expect(canvas.getByRole("button", { name: "Actualizar plan" })).toBeInTheDocument();
  },
};
