import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { within, expect, waitFor } from "storybook/test";
import { ObligacionDetailView } from "./obligacion-detail-view";

/* Detalle de una obligación / préstamo. `GET /api/treasury/obligations/:id`. */

const OK = http.get("*/api/treasury/obligations/:id", () =>
  HttpResponse.json(
    {
      obligation: {
        id: "obl-1",
        type: "loan",
        counterparty: "Banco BICE",
        principal_total: "12000000",
        annual_rate: "0.18",
        currency_code: "CLP",
        origination_date: "2026-01-15",
        installments_total: 6,
        status: "active",
        needs_review: false,
      },
      installments: [
        {
          number: 1,
          due_date: "2026-02-15",
          principal_amount: "1900000",
          interest_amount: "180000",
          total_amount: "2080000",
          status: "paid",
        },
        {
          number: 2,
          due_date: "2026-03-15",
          principal_amount: "1930000",
          interest_amount: "150000",
          total_amount: "2080000",
          status: "paid",
        },
        {
          number: 3,
          due_date: "2026-04-15",
          principal_amount: "1960000",
          interest_amount: "120000",
          total_amount: "2080000",
          status: "pending",
        },
        {
          number: 4,
          due_date: "2026-05-15",
          principal_amount: "1990000",
          interest_amount: "90000",
          total_amount: "2080000",
          status: "pending",
        },
      ],
    },
    { status: 200 },
  ),
);
const ERROR = http.get("*/api/treasury/obligations/:id", () =>
  HttpResponse.json({ detail: { code: "not_found", detail: "No existe." } }, { status: 404 }),
);
/* Préstamo totalmente pagado → el progreso muestra "Liquidado" (done). */
const PAID = http.get("*/api/treasury/obligations/:id", () =>
  HttpResponse.json(
    {
      obligation: {
        id: "obl-2",
        type: "loan",
        counterparty: "Banco de Chile",
        principal_total: "6000000",
        annual_rate: "0.15",
        currency_code: "CLP",
        origination_date: "2025-09-15",
        installments_total: 2,
        status: "paid",
        needs_review: false,
      },
      installments: [
        {
          number: 1,
          due_date: "2025-10-15",
          principal_amount: "2950000",
          interest_amount: "80000",
          total_amount: "3030000",
          status: "paid",
        },
        {
          number: 2,
          due_date: "2025-11-15",
          principal_amount: "3050000",
          interest_amount: "40000",
          total_amount: "3090000",
          status: "paid",
        },
      ],
    },
    { status: 200 },
  ),
);

const meta = {
  title: "Capa 2 / Pagar / ObligacionDetailView",
  component: ObligacionDetailView,
  args: { id: "obl-1" },
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof ObligacionDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConCalendario: Story = {
  name: "Con calendario",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El progreso macro (Timeline) aparece con datos reales: 2 de 6 pagadas.
    // Timeout holgado: en CI la query (MSW + react-query) tarda más que 1s.
    await waitFor(() => expect(canvas.getByText(/2 de 6 cuotas pagadas/)).toBeVisible(), {
      timeout: 8000,
    });
    await expect(canvas.getByText("Progreso del préstamo")).toBeVisible();
    await expect(canvas.getByText("Originado")).toBeVisible();
  },
};
export const Liquidada: Story = {
  name: "Liquidada (todas pagadas)",
  args: { id: "obl-2" },
  parameters: { msw: { handlers: [PAID] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText(/2 de 2 cuotas pagadas/)).toBeVisible(), {
      timeout: 8000,
    });
    await expect(canvas.getByText("Liquidado")).toBeVisible();
  },
};
export const Error: Story = { name: "No encontrada", parameters: { msw: { handlers: [ERROR] } } };
