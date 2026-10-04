import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import type { OperationalResultResponse, OperationalResultV2Response } from "@/lib/api/gestion";
import { RESULTADO_CORRIDO, RESULTADO_HORIZONTE } from "@/lib/gestion-titulos";
import { OperationalResultCorridoView } from "./operational-result-corrido-panel";
import { OperationalResultV2View } from "./operational-result-v2-panel";

/* Los DOS bloques de /gestion, juntos y en el estado que sirve producción HOY (2026-10-04):
   lo corrido con cifras reales y el horizonte abstenido. Ése es el caso que había que mirar —
   no el de los dos con datos— porque el productor V14 del horizonte responde 500 desde el 19
   de septiembre y la migración que lo arregla todavía no se aplicó a la base.

   Determinístico (props, sin red): una sola historia = un solo snapshot de Chromatic. */

const CORRIDO: OperationalResultResponse = {
  period: "2026-09",
  generated_at: "2026-10-04T12:00:00Z",
  revenue: "34334204",
  direct_cost: "6000000",
  gross_margin: "28334204",
  gross_margin_pct: "82.5",
  labor_cost: "11968052",
  professional_fees: "1500000",
  recurring_expenses: "2500000",
  unclassified_purchases: "300000",
  unclassified: "61016",
  financial_expense: "200000",
  ebitda_proxy: "12005186",
  result: "11805186",
  confidence: "high",
  data_state: "available",
  integrity: { decision_support: "eligible", period: "2026-09", state: "complete" },
  sources: [
    {
      code: "rcv",
      label: "Ventas y compras del SII",
      present: true,
      stale: false,
      applicable: true,
    },
    { code: "payroll", label: "Remuneraciones", present: true, stale: false, applicable: true },
  ],
  variation: {},
};

const HORIZONTE_ABSTENIDO: OperationalResultV2Response = {
  as_of: "2026-10-04T23:59:59-03:00",
  calculation_version: "v2.2026-09-08",
  definition_id: "qavante.period_statement.v2",
  scope: {
    period_from: "2026-10",
    period_to: "2027-01",
    as_of: "2026-10-04T23:59:59-03:00",
    timezone: "America/Santiago",
  },
  authority: { source: "treasury.operating_metric_snapshots", snapshot_id: null },
  coverage: {
    status: "unavailable",
    decision_support: "abstain",
    reason_codes: ["v14_operating_snapshot_missing"],
  },
  statement_v2: null,
};

function DosBloques() {
  return (
    <div className="space-y-6 p-4">
      <OperationalResultCorridoView mes={CORRIDO} />
      <OperationalResultV2View response={HORIZONTE_ABSTENIDO} />
    </div>
  );
}

const meta = {
  title: "Gestión/Bloques de resultado",
  component: DosBloques,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DosBloques>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CorridoConCifrasYHorizonteAbstenido: Story = {
  name: "Lo corrido con cifras · el horizonte abstenido (producción, 2026-10-04)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Dos rótulos DISTINTOS: el lector sabe de qué período habla cada bloque.
    await expect(canvas.getByText(RESULTADO_CORRIDO)).toBeInTheDocument();
    await expect(canvas.getByText(RESULTADO_HORIZONTE)).toBeInTheDocument();
    // Cada uno declara su período.
    await expect(canvas.getByText(/sep 2026 · base devengada/)).toBeInTheDocument();
    await expect(canvas.getByText(/oct 2026 a ene 2027/)).toBeInTheDocument();
    // Lo corrido publica la cifra verificada contra producción.
    await expect(canvas.getByText("$11.805.186")).toBeInTheDocument();
    // El horizonte se abstiene: ni cifra ni cero fabricado.
    await expect(canvas.getByText(/se abstuvo de publicar/)).toBeInTheDocument();
  },
};
