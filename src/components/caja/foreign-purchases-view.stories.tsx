import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { ForeignPurchasesView } from "./foreign-purchases-view";

/* Compras al extranjero (Caja). `GET /api/treasury/foreign-purchases`. */

const LOADED = http.get("*/api/treasury/foreign-purchases", () =>
  HttpResponse.json(
    {
      items: [
        {
          id: "fp-1",
          merchant: "OpenAI LLC",
          op_date: "2026-06-12",
          country: "Estados Unidos",
          amount_usd: "20.00",
          clp_operative: "19200",
          currency_origin: "USD",
          status: "pending",
          needs_review: true,
        },
        {
          id: "fp-2",
          merchant: "Amazon Web Services",
          op_date: "2026-06-10",
          country: "Estados Unidos",
          amount_usd: "143.20",
          clp_operative: "137500",
          currency_origin: "USD",
          status: "classified",
          needs_review: false,
          concept: "Hosting",
          category: "operational_expense",
        },
      ],
    },
    { status: 200 },
  ),
);
const EMPTY = http.get("*/api/treasury/foreign-purchases", () =>
  HttpResponse.json({ items: [] }, { status: 200 }),
);
const CLASSIFY = http.post("*/api/treasury/foreign-purchases/:id/classify", () =>
  HttpResponse.json({ status: "ok" }, { status: 200 }),
);
/* La categoría es una canónica del backend (filtramos a `cash_out`). */
const CANONICAL = http.get("*/api/treasury/canonical-categories", () =>
  HttpResponse.json(
    {
      items: [
        { code: "operational_expense", label: "Gasto operacional", cashflow_group: "cash_out" },
        { code: "supplier_payment", label: "Pago a proveedor", cashflow_group: "cash_out" },
        { code: "capex_payment", label: "Pago CAPEX", cashflow_group: "cash_out" },
        { code: "client_collection", label: "Cobro de cliente", cashflow_group: "cash_in" },
      ],
    },
    { status: 200 },
  ),
);

const meta = {
  title: "Capa 2 / Caja / ForeignPurchasesView",
  component: ForeignPurchasesView,
  parameters: {
    layout: "padded",
    msw: { handlers: [LOADED, CANONICAL, CLASSIFY] },
  },
} satisfies Meta<typeof ForeignPurchasesView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConCompras: Story = { name: "Con compras" };
export const Vacio: Story = {
  name: "Sin compras",
  parameters: { msw: { handlers: [EMPTY, CANONICAL] } },
};
