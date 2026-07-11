import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { within, expect } from "storybook/test";
import { OperationalResultView } from "./operational-result-view";
import { OperationalResultMatrix } from "./operational-result-matrix";
import type { OperationalResultBreakdown } from "@/lib/api/gestion";

/* Resultado Operacional de Gestión (Sprint C5). Container con selector de rango:
   un mes → vista rica (desglose fino + drivers); varios meses → Estado de
   Resultados mensualizado (matriz Chipax). La interacción de rango la cubre el
   e2e; acá la matriz se prueba en aislamiento con props (ADR-0018). */

const PATH = "*/api/management/operational-result";

const BREAKDOWN_FIXTURE: OperationalResultBreakdown = {
  generated_at: "2026-07-11T12:00:00Z",
  period_from: "2026-05",
  period_to: "2026-07",
  mode: "por_cuenta",
  months: ["2026-05", "2026-06", "2026-07"],
  proforma_month: "2026-07",
  rows: [
    {
      kind: "section",
      key: "income",
      label: "Total Ingresos",
      by_month: ["30958134", "28267191", "9924581"],
      total: "69149906",
      children: [
        { kind: "account", key: "proyectos", label: "Proyectos", by_month: ["15605246", "21413238", "0"], total: "37018484" },
        { kind: "account", key: "servicio", label: "Servicio Mensual", by_month: ["15352888", "6853953", "0"], total: "22206841" },
      ],
    },
    {
      kind: "section",
      key: "costs",
      label: "Total Costos",
      by_month: ["-11958854", "-12637376", "-365971"],
      total: "-24962201",
      children: [
        { kind: "account", key: "sueldos", label: "Sueldos", by_month: ["-7770357", "-7669268", "0"], total: "-15439625" },
      ],
    },
    {
      kind: "subtotal",
      key: "gross_margin",
      label: "Margen Bruto",
      by_month: ["18999280", "15629815", "9558610"],
      total: "44187705",
      pct_total: "63.9",
    },
  ],
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

/* Estado de Resultados mensualizado (matriz Chipax): meses en columnas, filas
   jerárquicas, Total, mes en curso "(proforma)". Determinístico (props, sin red);
   la interacción del selector la cubre el e2e. */
export const MatrizEstadoResultados: Story = {
  name: "Matriz Estado de Resultados (meses × cuentas)",
  render: () => <OperationalResultMatrix data={BREAKDOWN_FIXTURE} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Columnas de meses + proforma + secciones jerárquicas.
    await expect(canvas.getByText("Jul 2026")).toBeInTheDocument();
    await expect(canvas.getByText("(proforma)")).toBeInTheDocument();
    await expect(canvas.getByText("Total Ingresos")).toBeInTheDocument();
    await expect(canvas.getByText("Margen Bruto")).toBeInTheDocument();
    // Fila de cuenta hija visible (expandido por default).
    await expect(canvas.getByText("Proyectos")).toBeInTheDocument();
  },
};
