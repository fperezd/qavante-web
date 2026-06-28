import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { ObligacionesListView } from "./obligaciones-list-view";

/* Lista de obligaciones / préstamos (Pagar). `GET /api/treasury/obligations`.
   `useRouter`/Link auto-mock (appDirectory). */

const LOADED = http.get("*/api/treasury/obligations", () =>
  HttpResponse.json(
    {
      items: [
        {
          id: "obl-1",
          type: "loan",
          counterparty: "Banco BICE",
          principal_total: "12000000",
          annual_rate: "0.18",
          currency_code: "CLP",
          origination_date: "2026-01-15",
          installments_total: 12,
          status: "active",
          needs_review: false,
          pending_count: 9,
          next_due_date: "2026-07-15",
          outstanding_total: "9100000",
        },
        {
          id: "obl-2",
          type: "loan",
          counterparty: "Leasing Andes",
          principal_total: "4500000",
          annual_rate: "0.22",
          currency_code: "CLP",
          origination_date: "2025-09-01",
          installments_total: 18,
          status: "active",
          needs_review: true,
          pending_count: 11,
          next_due_date: "2026-07-01",
          outstanding_total: "2750000",
        },
      ],
    },
    { status: 200 },
  ),
);
const EMPTY = http.get("*/api/treasury/obligations", () =>
  HttpResponse.json({ items: [] }, { status: 200 }),
);
const ERROR = http.get("*/api/treasury/obligations", () =>
  HttpResponse.json({ detail: { code: "server_error", detail: "Falla." } }, { status: 500 }),
);

const meta = {
  title: "Capa 2 / Pagar / ObligacionesListView",
  component: ObligacionesListView,
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    msw: { handlers: [LOADED] },
  },
} satisfies Meta<typeof ObligacionesListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConObligaciones: Story = { name: "Con obligaciones" };
export const Vacio: Story = {
  name: "Sin obligaciones",
  parameters: { msw: { handlers: [EMPTY] } },
};
export const Error: Story = { name: "Error", parameters: { msw: { handlers: [ERROR] } } };
