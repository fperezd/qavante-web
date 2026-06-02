import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { OperationalResultView } from "./operational-result-view";

/* Resultado Operacional de Gestión (Sprint C5). Container con
   `useOperationalResult`. Contrato FE-first (endpoint aún no existe) → MSW
   reproduce los estados canónicos. */

const PATH = "*/api/management/operational-result";

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
