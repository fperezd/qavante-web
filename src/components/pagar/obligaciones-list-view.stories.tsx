import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { expect, within } from "storybook/test";
import { ObligacionesListView } from "./obligaciones-list-view";

/* Obligaciones con entidades financieras (Pagar). `GET /api/treasury/obligations`.
   La vista SEPARA por categoría (Créditos, Compras en cuotas, Leasing), así que el
   fixture cargado trae una de cada una: una sola categoría no ejercita el agrupamiento.
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
          type: "leasing",
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
        {
          id: "obl-3",
          type: "card_purchase",
          counterparty: "SII",
          principal_total: "627894",
          annual_rate: null,
          currency_code: "CLP",
          origination_date: "2026-06-10",
          installments_total: 6,
          status: "active",
          needs_review: false,
          pending_count: 4,
          next_due_date: "2026-08-10",
          outstanding_total: "418596",
        },
      ],
    },
    { status: 200 },
  ),
);
/* issue #94: 1 SOLA obligación con 1 SOLA cuota pendiente — el caso que "9 de 12 cuotas
 * pendientes" nunca ejercita. Antes escribía "1 cuotas pendientes" a mano, dos veces (el badge
 * del header y el detalle por fila). */
const UNA_CUOTA_PENDIENTE = http.get("*/api/treasury/obligations", () =>
  HttpResponse.json(
    {
      items: [
        {
          id: "obl-1",
          type: "loan",
          counterparty: "Banco BICE",
          principal_total: "1200000",
          annual_rate: "0.18",
          currency_code: "CLP",
          origination_date: "2026-01-15",
          installments_total: 12,
          status: "active",
          needs_review: false,
          pending_count: 1,
          next_due_date: "2026-07-15",
          outstanding_total: "100000",
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

export const ConObligaciones: Story = {
  name: "Con obligaciones",
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // [control positivo] 9 y 11 cuotas pendientes: plural, nunca singular.
    await expect((await c.findAllByText(/^\d+ cuotas pendientes$/)).length).toBeGreaterThan(0);
    await expect(c.queryByText(/^1 cuotas pendientes$/)).not.toBeInTheDocument();
    // Las tres categorías, cada una con su encabezado. Sin esto, un fixture de un solo
    // tipo dejaría pasar una vista que volviera a mezclarlo todo en una lista.
    await expect(await c.findByRole("heading", { name: "Créditos" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Compras en cuotas" })).toBeInTheDocument();
    await expect(c.getByRole("heading", { name: "Leasing" })).toBeInTheDocument();
  },
};
export const UnaCuotaPendiente: Story = {
  name: "1 sola cuota pendiente (issue #94, N=1)",
  parameters: { msw: { handlers: [UNA_CUOTA_PENDIENTE] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // El badge del header (Σ de pending_count = 1): singular exacto.
    await expect(await c.findByText("1 cuota pendiente")).toBeInTheDocument();
    // El detalle por fila ("1/12 cuota pendiente"): mismo singular, contexto distinto — antes
    // sólo tenía cobertura el número («9 de 12»), nunca el sustantivo de al lado con N=1.
    await expect(c.getByText(/1\/12\s+cuota pendiente(?!s)/)).toBeInTheDocument();
    await expect(c.queryByText(/1 cuotas pendientes/)).not.toBeInTheDocument();
    await expect(c.queryByText(/1\/12\s+cuotas pendientes/)).not.toBeInTheDocument();
  },
};
export const Vacio: Story = {
  name: "Sin obligaciones",
  parameters: { msw: { handlers: [EMPTY] } },
};
export const Error: Story = { parameters: { msw: { handlers: [ERROR] } } };
