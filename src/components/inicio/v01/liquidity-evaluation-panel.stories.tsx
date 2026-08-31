import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import type { LiquidityEvaluation } from "@/lib/api/financial-decisions";
import { LiquidityEvaluationPanel } from "./liquidity-evaluation-panel";

const EVALUATION: LiquidityEvaluation = {
  decision_id: "10000000-0000-4000-8000-000000000001",
  status: "evaluated",
  decision_support: "eligible",
  model_version: "fpde-f1",
  recommended_alternative_id: "line",
  scope: {
    legal_entity_id: "20000000-0000-4000-8000-000000000001",
    currency: "CLP",
    as_of: "2026-08-31T09:00:00Z",
    horizon_days: 90,
    valid_until: "2026-09-01T09:00:00Z",
  },
  situation: {},
  event: {
    amount_peak: "10000000",
    baseline_min_cash: "-8000000",
    recovery_date: "2026-09-20",
  },
  alternatives: [
    {
      id: "line",
      code: "credit_line:quote-1",
      family: "credit_line",
      rank: 1,
      is_no_action: false,
      is_rejected: false,
      explanation: { summary: "Cubre la brecha con términos vigentes." },
      parameters: {},
      simulation: {},
      comparison: {},
      cost_status: "known",
      cost: {
        status: "known",
        total_financial_cost: "250000",
        contract_version: "cost.v1",
        evidence_refs: ["quote:1"],
      },
    },
    {
      id: "factoring",
      code: "factoring:invoice-1",
      family: "factoring",
      rank: 2,
      is_no_action: false,
      is_rejected: false,
      explanation: {},
      parameters: {},
      simulation: {},
      comparison: {},
      cost_status: "unknown",
    },
    {
      id: "none",
      code: "no_action",
      family: "no_action",
      rank: 3,
      is_no_action: true,
      is_rejected: false,
      explanation: {},
      parameters: {},
      simulation: {},
      comparison: {},
      cost_status: "not_applicable",
    },
  ],
};

const meta = {
  title: "Rediseño F2 / V01 Hoy / Evaluación de liquidez",
  component: LiquidityEvaluationPanel,
  parameters: { layout: "padded" },
  args: { evaluation: EVALUATION, now: new Date("2026-08-31T12:00:00Z") },
} satisfies Meta<typeof LiquidityEvaluationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Comparable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Alternativas para proteger tu caja" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("1. Usar línea de crédito")).toBeInTheDocument();
    await expect(canvas.getByText("2. Factorizar factura completa")).toBeInTheDocument();
    await expect(canvas.getByText("3. No financiar")).toBeInTheDocument();
    await expect(canvas.getByText("Costo financiero total $250.000")).toBeInTheDocument();
    await expect(canvas.getByText("Costo aún no verificable")).toBeInTheDocument();
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const Abstencion: Story = {
  args: { evaluation: { ...EVALUATION, decision_support: "abstain" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Qavante se abstuvo de recomendar")).toBeInTheDocument();
    await expect(canvas.getByText(/No se asumieron tasas, costos ni montos/)).toBeInTheDocument();
    await expect(canvas.queryByText("Mejor alternativa evaluada")).not.toBeInTheDocument();
  },
};

export const SinEvaluacion: Story = {
  args: { evaluation: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Aún no hay una evaluación de liquidez persistida"),
    ).toBeInTheDocument();
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
  },
};

export const Vencida: Story = {
  args: {
    evaluation: {
      ...EVALUATION,
      scope: { ...EVALUATION.scope, valid_until: "2026-08-30T09:00:00Z" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Evaluación sin recomendación vigente" }),
    ).toBeInTheDocument();
    await expect(canvas.queryByText("Mejor alternativa evaluada")).not.toBeInTheDocument();
    await expect(canvas.getByText(/no usar para decidir/i)).toBeInTheDocument();
  },
};
