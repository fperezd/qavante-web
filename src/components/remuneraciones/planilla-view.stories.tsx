import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { UseQueryResult } from "@tanstack/react-query";
import { PlanillaView } from "./planilla-view";
import type { PayrollResponse } from "@/lib/api/buk";

/* PlanillaView — totales agregados de remuneraciones del período (BUK).
   Presentacional: recibe `query` por prop. Fake-UseQueryResult (sin MSW). */

type PayQuery = UseQueryResult<PayrollResponse, unknown>;

function buildQuery(opts: Partial<PayQuery>): PayQuery {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    isPending: false,
    status: "success",
    fetchStatus: "idle",
    ...opts,
  } as PayQuery;
}

const SUCCESS: PayrollResponse = {
  status: "ok",
  period: "2026-03",
  totales: {
    total_haberes: 18450000,
    total_descuentos: 4120000,
    total_liquido: 14330000,
    total_imponible: 16800000,
    empleados_contados: 12,
  },
} as PayrollResponse;

const meta = {
  title: "Capa 2 / Remuneraciones / PlanillaView",
  component: PlanillaView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Totales agregados de planilla del período (BUK). Por privacidad no expone detalle por empleado. Presentacional: recibe `query` por prop. Gated `remuneraciones`.",
      },
    },
  },
  args: { onPeriodChange: fn() },
} satisfies Meta<typeof PlanillaView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicial: Story = {
  name: "Inicial (sin período)",
  args: {
    period: null,
    query: buildQuery({ isSuccess: false, status: "pending", isPending: true }),
  },
};

export const ConTotales: Story = {
  name: "Con totales",
  args: { period: "2026-03", query: buildQuery({ data: SUCCESS }) },
};

export const SinPlanilla: Story = {
  name: "Período sin planilla",
  args: {
    period: "2026-03",
    query: buildQuery({ data: { status: "ok", period: "2026-03" } as PayrollResponse }),
  },
};

export const Cargando: Story = {
  args: {
    period: "2026-03",
    query: buildQuery({ isLoading: true, isFetching: true, isPending: true, isSuccess: false, status: "pending" }),
  },
};

export const ConError: Story = {
  name: "Error (BUK no responde / 401)",
  args: {
    period: "2026-03",
    query: buildQuery({
      isError: true,
      isSuccess: false,
      status: "error",
      error: new globalThis.Error("No pudimos consultar la planilla en BUK."),
    }),
  },
};
