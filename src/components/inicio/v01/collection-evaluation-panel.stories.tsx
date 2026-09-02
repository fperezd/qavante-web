import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import type { CollectionEvaluation, CollectionSituation } from "@/lib/api/collection-decisions";
import { CollectionEvaluationPanel } from "./collection-evaluation-panel";

const scope = {
  tenant_id: "10000000-0000-4000-8000-000000000001",
  legal_entity_id: "20000000-0000-4000-8000-000000000001",
  currency: "CLP",
  as_of: "2026-09-01T12:00:00Z",
};

const situation: CollectionSituation = {
  scope,
  state: "ready",
  freshness: "fresh",
  source_refs: ["source:rcv"],
  snapshot_hash: "snapshot-1",
  receivables: [],
  payables: [],
};

const evaluation: CollectionEvaluation = {
  scope,
  state: "abstained",
  abstain_reasons: ["insufficient_evidence"],
  freshness: "stale",
  source_refs: ["source:rcv"],
  snapshot_hash: "snapshot-1",
  evaluations: [
    {
      subject_kind: "receivable",
      subject_ref: "receivable:1",
      state: "ready",
      alternatives: [
        {
          code: "accelerate_collection",
          eligibility_state: "not_evaluable",
          is_no_action: false,
          reason_codes: ["missing_due_date"],
          evidence_refs: [],
        },
      ],
    },
  ],
};

const meta = {
  title: "Rediseño V01 / Evaluación de cobranza",
  component: CollectionEvaluationPanel,
  parameters: { layout: "padded", a11y: { test: "error" } },
} satisfies Meta<typeof CollectionEvaluationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScopeRequerido: Story = {
  args: { situation: null, evaluation: null, scopeAvailable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Contexto de entidad requerido" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const AbstencionYNoEvaluable: Story = {
  args: { situation, evaluation, scopeAvailable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Qavante se abstuvo de recomendar" }),
    ).toBeVisible();
    await expect(canvas.getByText("No hay recomendación de cobranza")).toBeVisible();
    await expect(canvas.getByText("No evaluable")).toBeVisible();
    await expect(canvas.getByText("missing_due_date")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const SituacionAbstenida: Story = {
  args: {
    situation: {
      ...situation,
      state: "abstained",
      abstain_reasons: ["missing_collection_snapshot"],
      receivables: undefined,
      payables: undefined,
    },
    evaluation: { ...evaluation, state: "ready", abstain_reasons: undefined },
    scopeAvailable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Situación de cobranza no informada")).toBeVisible();
    await expect(canvas.getByText("missing_collection_snapshot")).toBeVisible();
    await expect(canvas.getAllByText("No informado")).toHaveLength(2);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const ErrorDeReader: Story = {
  args: { situation: null, evaluation: null, scopeAvailable: true, error: new Error("network") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
