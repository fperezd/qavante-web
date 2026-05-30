import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { CashFlowView } from "./cash-flow-view";
import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";

/* CashFlowView — container de `/caja/proyeccion` (Sprint C3 MVP). Usa
   `useCashFlowReport` para loading/error/empty/tabla; los filtros (período,
   granularidad, capa) son por interacción. Handlers MSW para
   `GET /api/treasury/reports/cash-flow`. Endpoint desbloqueado por ADR-0027
   (cookie auth) — pantalla activable en prod. */

const REPORT: CashFlowReportResponse = {
  period_from: "2026-03",
  period_to: "2026-05",
  granularity: "month",
  financial_layer: "committed",
  group_by: "none",
  currency: "functional",
  excluded_attention: 0,
  warnings: [],
  buckets: [
    {
      period: "2026-03",
      total_inflow: "5000000",
      total_outflow: "3200000",
      net: "1800000",
      row_count: 42,
      groups: [],
    },
    {
      period: "2026-04",
      total_inflow: "6200000",
      total_outflow: "4100000",
      net: "2100000",
      row_count: 51,
      groups: [],
    },
    {
      period: "2026-05",
      total_inflow: "4800000",
      total_outflow: "5300000",
      net: "-500000",
      row_count: 38,
      groups: [],
    },
  ],
  grand_total: { inflow: "16000000", outflow: "12600000", net: "3400000", row_count: 131 },
};

const EMPTY_REPORT: CashFlowReportResponse = {
  ...REPORT,
  buckets: [],
  grand_total: { inflow: "0", outflow: "0", net: "0", row_count: 0 },
};

const PATH = "*/api/treasury/reports/cash-flow*";

const OK = http.get(PATH, () => HttpResponse.json(REPORT, { status: 200 }));
const EMPTY = http.get(PATH, () => HttpResponse.json(EMPTY_REPORT, { status: 200 }));
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json(REPORT, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos generar el reporte de caja." },
    { status: 500 },
  ),
);

const meta = {
  title: "Capa 2 / Caja / CashFlowView",
  component: CashFlowView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proyección de caja (Sprint C3 MVP, `/caja/proyeccion`). El container resuelve loading/error/empty/tabla desde `GET /api/treasury/reports/cash-flow`. Filtros por interacción. No inventa lógica financiera — muestra lo que devuelve el endpoint (ADR-0013).",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof CashFlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConDatos: Story = {
  name: "Con datos (3 meses)",
  parameters: { msw: { handlers: [OK] } },
};

export const Vacio: Story = {
  name: "Vacío (sin movimientos en el período)",
  parameters: { msw: { handlers: [EMPTY] } },
};

export const Cargando: Story = {
  name: "Cargando (skeleton)",
  parameters: { msw: { handlers: [LOADING] } },
};

export const Error500: Story = {
  name: "Error (500)",
  parameters: { msw: { handlers: [ERROR] } },
};
