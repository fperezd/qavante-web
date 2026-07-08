import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { CashFlowNetSummary } from "./cash-flow-net-summary";
import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";

/* Resumen del flujo neto (sparkline con línea de cero). Se prueba en aislamiento
   con props (ADR-0018): render determinístico, sin red. Datos = buckets[].net
   reales del reporte de caja. */

const bucket = (period: string, inflow: string, outflow: string, net: string) => ({
  period,
  total_inflow: inflow,
  total_outflow: outflow,
  net,
  row_count: 3,
});

const base: CashFlowReportResponse = {
  period_from: "2026-05",
  period_to: "2026-06",
  granularity: "week",
  financial_layer: "committed",
  group_by: "none",
  currency: "functional",
  currency_code: "CLP",
  excluded_attention: 0,
  buckets: [
    bucket("2026-W19", "8200000", "6100000", "2100000"),
    bucket("2026-W20", "5400000", "7900000", "-2500000"),
    bucket("2026-W21", "6800000", "6300000", "500000"),
    bucket("2026-W22", "4100000", "9200000", "-5100000"),
    bucket("2026-W23", "9600000", "5800000", "3800000"),
  ],
  grand_total: {
    inflow: "34100000",
    outflow: "35300000",
    net: "-1200000",
    row_count: 15,
  },
};

const meta = {
  title: "Capa 2 / Caja / CashFlowNetSummary",
  component: CashFlowNetSummary,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CashFlowNetSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NetoNegativo: Story = {
  name: "Neto del rango negativo",
  args: { data: base },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await expect(canvas.getByText("Flujo neto del rango")).toBeVisible();
    // Neto total negativo → en rojo, con el signo −.
    await expect(canvas.getByText("−$1.200.000")).toBeVisible();
    await expect(canvas.getByText(/Neto por semana · 5/)).toBeVisible();
    // El ⓘ es operable por teclado; su tooltip se portalea a document.body.
    canvas.getByRole("button", { name: /Qué significa el flujo neto/i }).focus();
    await waitFor(() => expect(body.getByText(/entró menos lo que salió/i)).toBeVisible());
  },
};

export const NetoPositivo: Story = {
  name: "Neto del rango positivo",
  args: {
    data: {
      ...base,
      grand_total: { inflow: "40000000", outflow: "33000000", net: "7000000", row_count: 15 },
    },
  },
};

export const UnSoloPeriodo: Story = {
  name: "Un solo período (no renderiza)",
  args: { data: { ...base, buckets: [base.buckets![0]!] } },
};
