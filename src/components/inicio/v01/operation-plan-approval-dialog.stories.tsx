import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HttpResponse, http } from "msw";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { OperationApprovalRequest } from "@/lib/api/financial-decisions";
import { OperationPlanApprovalDialog } from "./operation-plan-approval-dialog";

const PLAN_ID = "50000000-0000-4000-8000-000000000001";
const onRequested = fn();

const meta = {
  title: "Inicio/V01/OperationPlanApprovalDialog",
  component: OperationPlanApprovalDialog,
  args: {
    operationPlanId: PLAN_ID,
    evidenceRefs: ["quote:1", "terms:1"],
    onRequested,
  },
  parameters: { layout: "padded", a11y: { test: "error" } },
  tags: ["autodocs"],
} satisfies Meta<typeof OperationPlanApprovalDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

let requests: OperationApprovalRequest[] = [];

async function openAndFill() {
  const body = within(document.body);
  await userEvent.click(body.getByRole("button", { name: "Solicitar aprobación" }));
  const dialog = await body.findByRole("dialog");
  await userEvent.type(
    within(dialog).getByLabelText("Motivo de la solicitud"),
    "Solicito revisión con la evidencia anclada",
  );
  return { body, dialog };
}

export const SolicitudExitosa: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post(
          "*/api/treasury/operation-plans/:operationPlanId/request-approval",
          async ({ request }) => {
            requests.push((await request.json()) as OperationApprovalRequest);
            return HttpResponse.json({
              operation_plan_id: PLAN_ID,
              event_id: "80000000-0000-4000-8000-000000000001",
              from_status: "draft",
              to_status: "awaiting_approval",
              occurred_at: "2026-09-01T10:00:00Z",
              replayed: false,
            });
          },
        ),
      ],
    },
  },
  play: async () => {
    requests = [];
    onRequested.mockClear();
    const { dialog } = await openAndFill();
    await expect(within(dialog).getByText(/no lo aprueba.*ni mueve dinero/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar solicitud" }));
    await waitFor(() => expect(onRequested).toHaveBeenCalledOnce());
    await expect(requests[0]).toMatchObject({
      evidence_refs: ["quote:1", "terms:1"],
      rationale: "Solicito revisión con la evidencia anclada",
    });
  },
};

export const Error412NoConfirma: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/treasury/operation-plans/:operationPlanId/request-approval", () =>
          HttpResponse.json({ detail: "precondition_failed" }, { status: 412 }),
        ),
      ],
    },
  },
  play: async () => {
    onRequested.mockClear();
    const { dialog } = await openAndFill();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar solicitud" }));
    await expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /no cumple una condición vigente/i,
    );
    await expect(onRequested).not.toHaveBeenCalled();
  },
};
