import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { expect, userEvent, within } from "storybook/test";
import { DocumentActionButton } from "./document-actions";
import type { ActionDetail, PaymentInput, FollowupInput } from "@/lib/api/document-actions";

const id = "00000000-0000-4000-8000-000000000540";
const path = `*/api/treasury/document-actions/payable/${id}`;
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
const base = (): ActionDetail => ({
  id,
  name: "Proveedor de ejemplo",
  document_ref: "Factura 123",
  source_external_id: "33-123-76111111-9",
  document_kind: "payable",
  issue_date: "2025-01-01",
  due_date: "2026-01-01",
  outstanding_amount: "10000",
  total_amount: "10000",
  currency_code: "CLP",
  status: "open",
  ceded_at: null,
  in_followup: false,
  actions: [],
});
function handlers() {
  let data = base();
  return [
    http.get(path, () => HttpResponse.json(data)),
    http.get(`${path}/suggestions`, () => HttpResponse.json({ items: [] })),
    http.get(`${path}/payments/:actionId/candidates`, () => HttpResponse.json({ items: [] })),
    http.post(`${path}/payments`, async ({ request }) => {
      const payload = (await request.json()) as PaymentInput;
      data = {
        ...data,
        outstanding_amount: String(Number(data.outstanding_amount) - Number(payload.amount)),
        status: "partially_paid",
        actions: [
          {
            id,
            action_type: "payment",
            status: "active",
            action_date: payload.date,
            amount: String(payload.amount),
            currency_code: "CLP",
            actor_user_id: id,
            created_at: new Date().toISOString(),
            changed_at: null,
            bank_movement_id: null,
            payload: {
              ...payload,
              amount: String(payload.amount),
              expected_outstanding: String(payload.expected_outstanding),
            },
          },
        ],
      };
      return HttpResponse.json(data);
    }),
    http.post(`${path}/followups`, async ({ request }) => {
      const payload = (await request.json()) as FollowupInput;
      data = {
        ...data,
        in_followup: true,
        actions: [
          {
            id,
            action_type: "followup",
            status: "active",
            action_date: payload.date,
            amount: null,
            currency_code: "CLP",
            actor_user_id: id,
            created_at: new Date().toISOString(),
            changed_at: null,
            bank_movement_id: null,
            payload: { ...payload, expected_outstanding: String(payload.expected_outstanding) },
          },
        ],
      };
      return HttpResponse.json(data);
    }),
  ];
}

const meta = {
  title: "Documentos/Acciones",
  component: DocumentActionButton,
  args: { kind: "payable", documentId: id },
} satisfies Meta<typeof DocumentActionButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PagoParcial: Story = {
  parameters: { msw: { handlers: handlers() } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Gestionar" }));
    const page = within(document.body);
    await userEvent.click(await page.findByRole("button", { name: "Registrar pago" }));
    const amount = page.getByLabelText("Monto (CLP)");
    await userEvent.clear(amount);
    await userEvent.type(amount, "3000");
    await userEvent.click(page.getByRole("button", { name: "Guardar pago" }));
    await expect(await page.findByText(/Pendiente:.*7.000/)).toBeVisible();
    await expect(page.getByText(/Registro manual/)).toBeVisible();
    await expect(page.queryByText("Conciliado con banco")).not.toBeInTheDocument();
  },
};

export const Seguimiento: Story = {
  parameters: { msw: { handlers: handlers() } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Gestionar" }));
    const page = within(document.body);
    await userEvent.click(await page.findByRole("button", { name: "Programar seguimiento" }));
    const future = new Date(`${today()}T12:00:00Z`);
    future.setUTCDate(future.getUTCDate() + 7);
    await userEvent.type(
      page.getByLabelText("Volver a revisar el"),
      future.toISOString().slice(0, 10),
    );
    await userEvent.click(page.getByRole("button", { name: "Guardar seguimiento" }));
    await expect(await page.findByText(/En seguimiento. Sin tarea inmediata/)).toBeVisible();
    await expect(page.getByText(/Pendiente:.*10.000/)).toBeVisible();
    await expect(page.getByText("Vence: 01-01-2026")).toBeVisible();
  },
};
