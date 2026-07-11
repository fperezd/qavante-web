import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CashFlowTable } from "./cash-flow-table";
import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";

const meta = {
  title: "Caja / CashFlowTable",
  component: CashFlowTable,
  parameters: {
    docs: {
      description: {
        component:
          "Vista tabular del reporte agregado /api/treasury/reports/cash-flow. Recibe la data resuelta; presentacional puro. Filas = buckets temporales; columnas = Período, Entrada, Salida, Neto, Movimientos. Footer = grand_total.",
      },
    },
  },
} satisfies Meta<typeof CashFlowTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleWeek: CashFlowReportResponse = {
  period_from: "2026-05",
  period_to: "2026-08",
  granularity: "week",
  financial_layer: "committed",
  group_by: "none",
  currency: "functional",
  buckets: [
    {
      period: "2026-05-04",
      total_inflow: "12500000",
      total_outflow: "8200000",
      net: "4300000",
      row_count: 14,
    },
    {
      period: "2026-05-11",
      total_inflow: "9800000",
      total_outflow: "11500000",
      net: "-1700000",
      row_count: 11,
    },
    {
      period: "2026-05-18",
      total_inflow: "15200000",
      total_outflow: "7400000",
      net: "7800000",
      row_count: 17,
    },
    {
      period: "2026-05-25",
      total_inflow: "0",
      total_outflow: "9300000",
      net: "-9300000",
      row_count: 5,
    },
  ],
  grand_total: {
    inflow: "37500000",
    outflow: "36400000",
    net: "1100000",
    row_count: 47,
  },
  excluded_attention: 0,
  warnings: [],
};

export const Default: Story = {
  name: "Semanal (fechas reales, no 'W1')",
  args: { data: sampleWeek },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La semana se lee como rango de fechas reales, no un número de semana.
    await expect(canvas.getByText("Sem. 11–17 may")).toBeVisible();
    await expect(canvas.getByText("Sem. 4–10 may")).toBeVisible();
  },
};

export const ConWarnings: Story = {
  args: {
    data: {
      ...sampleWeek,
      warnings: ["Algunos buckets tienen rate de tipo de cambio interpolado — verificar con BCCH."],
    },
  },
};

export const ConFilasExcluidas: Story = {
  args: {
    data: {
      ...sampleWeek,
      excluded_attention: 3,
    },
  },
};

export const Mensual: Story = {
  args: {
    data: {
      period_from: "2026-01",
      period_to: "2026-06",
      granularity: "month",
      financial_layer: "committed",
      group_by: "none",
      currency: "functional",
      buckets: [
        {
          period: "2026-01",
          total_inflow: "42000000",
          total_outflow: "38000000",
          net: "4000000",
          row_count: 52,
        },
        {
          period: "2026-02",
          total_inflow: "38500000",
          total_outflow: "39200000",
          net: "-700000",
          row_count: 48,
        },
        {
          period: "2026-03",
          total_inflow: "51000000",
          total_outflow: "42000000",
          net: "9000000",
          row_count: 61,
        },
        {
          period: "2026-04",
          total_inflow: "47800000",
          total_outflow: "44500000",
          net: "3300000",
          row_count: 55,
        },
        {
          period: "2026-05",
          total_inflow: "39200000",
          total_outflow: "41100000",
          net: "-1900000",
          row_count: 50,
        },
        {
          period: "2026-06",
          total_inflow: "52500000",
          total_outflow: "39800000",
          net: "12700000",
          row_count: 58,
        },
      ],
      grand_total: {
        inflow: "271000000",
        outflow: "244600000",
        net: "26400000",
        row_count: 324,
      },
      excluded_attention: 0,
    },
  },
};
