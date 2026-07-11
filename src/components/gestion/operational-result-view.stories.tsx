import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { within, expect } from "storybook/test";
import { OperationalResultView, RangeResult } from "./operational-result-view";
import type { OperationalResultReport } from "@/lib/api/gestion";

/* Resultado Operacional de Gestión (Sprint C5). Container con selector de rango:
   un mes → vista rica (desglose fino + drivers); varios meses → agregado del
   período + mes a mes. La interacción de rango completa la cubre el e2e; acá el
   RangeResult se prueba en aislamiento con props (ADR-0018). */

const PATH = "*/api/management/operational-result";

const RANGE_FIXTURE: OperationalResultReport = {
  period_from: "2026-03",
  period_to: "2026-05",
  buckets: [
    { period: "2026-03", revenue: "8000000", cogs: "2000000", gross_margin: "6000000", gasto: "3000000", ebitda_proxy: "3000000", result: "3000000" },
    { period: "2026-04", revenue: "8500000", cogs: "2000000", gross_margin: "6500000", gasto: "3000000", ebitda_proxy: "3500000", result: "3500000" },
    { period: "2026-05", revenue: "9000000", cogs: "2000000", gross_margin: "7000000", gasto: "3000000", ebitda_proxy: "4000000", result: "4000000" },
  ],
  grand_total: { revenue: "25500000", cogs: "6000000", gross_margin: "19500000", gasto: "9000000", ebitda_proxy: "10500000", result: "10500000" },
};

const FIXTURE = {
  period: "2026-05",
  revenue: "18500000",
  direct_cost: "7400000",
  gross_margin: "11100000",
  gross_margin_pct: "60.0",
  labor_cost: "4200000",
  professional_fees: "900000",
  recurring_expenses: "2100000",
  ebitda_proxy: "3900000",
  result: "3900000",
  variation: {
    vs_previous_month: { amount: "600000", pct: "18.2" },
    vs_same_month_last_year: { amount: "-300000", pct: "-7.1" },
  },
  drivers: [
    {
      direction: "improves",
      concept: "Ventas",
      impact: "1200000",
      explanation: "Más ventas que el mes anterior.",
    },
    {
      direction: "worsens",
      concept: "Sueldos",
      impact: "-500000",
      explanation: "Subió el gasto en remuneraciones.",
    },
  ],
  confidence: "high",
  data_state: "available",
  missing_sources: [],
  generated_at: "2026-06-01T12:00:00Z",
};

const OK = http.get(PATH, () => HttpResponse.json(FIXTURE, { status: 200 }));
const NEGATIVO = http.get(PATH, () =>
  HttpResponse.json(
    {
      ...FIXTURE,
      result: "-1200000",
      ebitda_proxy: "-1200000",
      confidence: "low",
      missing_sources: ["Previred"],
      variation: {
        vs_previous_month: { amount: "-1800000", pct: "-45.0" },
        vs_same_month_last_year: null,
      },
    },
    { status: 200 },
  ),
);
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json(FIXTURE, { status: 200 });
});
const NOT_FOUND = http.get(PATH, () =>
  HttpResponse.json({ code: "not_found", detail: "Sin datos." }, { status: 404 }),
);
const ERROR = http.get(PATH, () =>
  HttpResponse.json({ code: "internal_error", detail: "Falló." }, { status: 500 }),
);

const meta = {
  title: "Capa 2 / Gestión / OperationalResultView",
  component: OperationalResultView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Resultado Operacional de Gestión (Sprint C5, Maestro §7.5). Badge obligatorio 'no es contabilidad oficial', desglose P&L, variación mes/año, drivers (rule-based) y confianza + fuentes faltantes. Estados canónicos vía MSW. Contrato FE-first (endpoint aún no existe en backend).",
      },
    },
    msw: { handlers: [OK] },
  },
  args: { initialPeriod: "2026-05" },
} satisfies Meta<typeof OperationalResultView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disponible: Story = {
  name: "Disponible (resultado positivo)",
  parameters: { msw: { handlers: [OK] } },
};
export const ResultadoNegativo: Story = {
  name: "Resultado negativo + confianza baja + fuente faltante",
  parameters: { msw: { handlers: [NEGATIVO] } },
};
export const Cargando: Story = { parameters: { msw: { handlers: [LOADING] } } };
export const SinDatos: Story = {
  name: "Sin datos del período (404)",
  parameters: { msw: { handlers: [NOT_FOUND] } },
};
export const Error500: Story = {
  name: "Error (500)",
  parameters: { msw: { handlers: [ERROR] } },
};

/* Vista de RANGO (varios meses): agregado del período + tabla mes a mes.
   Determinística (props, sin red); la interacción del selector la cubre el e2e. */
export const RangoMultiMes: Story = {
  name: "Rango de varios meses (total + mes a mes)",
  render: () => <RangeResult data={RANGE_FIXTURE} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Resultado operacional del período")).toBeInTheDocument();
    await expect(canvas.getByText("Mes a mes")).toBeInTheDocument();
    // Total del período (grand_total.result) — aparece en el hero y en el desglose.
    await expect(canvas.getAllByText("$10.500.000").length).toBeGreaterThan(0);
  },
};
