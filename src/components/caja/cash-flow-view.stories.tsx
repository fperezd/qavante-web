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

/* Granularidad SEMANAL: buckets = lunes de cada semana (YYYY-MM-DD) → la tabla
   los muestra como DD-MM-AAAA (convención mes-año, nunca año-mes). */
const WEEK_REPORT: CashFlowReportResponse = {
  ...REPORT,
  period_from: "2026-06",
  period_to: "2026-07",
  granularity: "week",
  buckets: [
    {
      period: "2026-06-01",
      total_inflow: "1200000",
      total_outflow: "800000",
      net: "400000",
      row_count: 11,
      groups: [],
    },
    {
      period: "2026-06-08",
      total_inflow: "1500000",
      total_outflow: "900000",
      net: "600000",
      row_count: 14,
      groups: [],
    },
    {
      period: "2026-06-15",
      total_inflow: "1100000",
      total_outflow: "1300000",
      net: "-200000",
      row_count: 9,
      groups: [],
    },
    {
      period: "2026-06-22",
      total_inflow: "1800000",
      total_outflow: "1000000",
      net: "800000",
      row_count: 16,
      groups: [],
    },
    {
      period: "2026-06-29",
      total_inflow: "1300000",
      total_outflow: "1200000",
      net: "100000",
      row_count: 12,
      groups: [],
    },
    {
      period: "2026-07-06",
      total_inflow: "1600000",
      total_outflow: "1400000",
      net: "200000",
      row_count: 13,
      groups: [],
    },
  ],
  grand_total: { inflow: "8500000", outflow: "6600000", net: "1900000", row_count: 75 },
};

/* Granularidad DIARIA: buckets = días (YYYY-MM-DD) → DD-MM-AAAA en la tabla. */
const DAY_REPORT: CashFlowReportResponse = {
  ...REPORT,
  period_from: "2026-06",
  period_to: "2026-07",
  granularity: "day",
  buckets: [
    {
      period: "2026-06-01",
      total_inflow: "300000",
      total_outflow: "200000",
      net: "100000",
      row_count: 3,
      groups: [],
    },
    {
      period: "2026-06-02",
      total_inflow: "250000",
      total_outflow: "400000",
      net: "-150000",
      row_count: 4,
      groups: [],
    },
    {
      period: "2026-06-03",
      total_inflow: "500000",
      total_outflow: "150000",
      net: "350000",
      row_count: 5,
      groups: [],
    },
    {
      period: "2026-06-04",
      total_inflow: "200000",
      total_outflow: "220000",
      net: "-20000",
      row_count: 2,
      groups: [],
    },
    {
      period: "2026-06-05",
      total_inflow: "600000",
      total_outflow: "300000",
      net: "300000",
      row_count: 6,
      groups: [],
    },
    {
      period: "2026-06-08",
      total_inflow: "450000",
      total_outflow: "500000",
      net: "-50000",
      row_count: 4,
      groups: [],
    },
    {
      period: "2026-06-09",
      total_inflow: "350000",
      total_outflow: "180000",
      net: "170000",
      row_count: 3,
      groups: [],
    },
  ],
  grand_total: { inflow: "2650000", outflow: "1950000", net: "700000", row_count: 27 },
};

/* Mapa granularidad → reporte mock, para que el selector cambie la data
   visible (el mock estático devolvía siempre lo mismo). */
const REPORT_BY_GRANULARITY: Record<string, CashFlowReportResponse> = {
  month: REPORT,
  week: WEEK_REPORT,
  day: DAY_REPORT,
};

const EMPTY_REPORT: CashFlowReportResponse = {
  ...REPORT,
  buckets: [],
  grand_total: { inflow: "0", outflow: "0", net: "0", row_count: 0 },
};

const PATH = "*/api/treasury/reports/cash-flow*";

/* Devuelve el mock acorde a la granularidad del query (?granularity=week|day|month)
   para que al elegir Semana/Día + Aplicar se vea data distinta. */
const OK = http.get(PATH, ({ request }) => {
  const granularity = new URL(request.url).searchParams.get("granularity") ?? "month";
  return HttpResponse.json(REPORT_BY_GRANULARITY[granularity] ?? REPORT, { status: 200 });
});
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
