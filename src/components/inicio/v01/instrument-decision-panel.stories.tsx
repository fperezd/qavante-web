import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { instrumentDecisionStoryLayer } from "./instrument-decision.fixtures";
import { InstrumentDecisionPanel } from "./instrument-decision-panel";

const meta = {
  title: "Rediseño F3-F9 / Capa común de instrumentos",
  component: InstrumentDecisionPanel,
  parameters: {
    layout: "padded",
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "Boundary de presentación puro para contratos internos F4–F8. F3 y F9 declaran sus dependencias abiertas; no hay fetch, CTA, aprobación, submission ni ejecución.",
      },
    },
  },
  args: { layer: instrumentDecisionStoryLayer() },
} satisfies Meta<typeof InstrumentDecisionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CuatroEstadosYDependencias: Story = {
  name: "Cuatro estados, no_action y contratos pendientes",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { name: "Instrumentos en evaluación" })).toBeVisible();
    await expect(canvas.getAllByText("Elegible")).toHaveLength(2);
    for (const state of ["Potencialmente elegible", "No elegible", "No evaluable"]) {
      await expect(canvas.getByText(state)).toBeVisible();
    }

    await expect(canvas.getByRole("heading", { name: "Cobranza y reprogramación" })).toBeVisible();
    await expect(canvas.getByText("Dependencia: qavante-api#300")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "No actuar" })).toBeVisible();
    await expect(canvas.getByText("Alternativa no_action · sin operación")).toBeVisible();
    await expect(canvas.getByText("Costo de instrumento no aplica")).toBeVisible();

    await expect(canvas.getByRole("heading", { name: "Resultado y Value Ledger" })).toBeVisible();
    await expect(canvas.getByText("Dependencia: qavante-api#304")).toBeVisible();
    await expect(canvas.getAllByText("Sin dato")).toHaveLength(2);
    await expect(
      canvas.getByText("Integraciones externas deshabilitadas · sin envío ni ejecución"),
    ).toBeVisible();

    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
  },
};

export const UnknownNoEsCero: Story = {
  name: "Costo y vigencia desconocidos no son cero",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Costo no verificable").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Vigencia no informada").length).toBeGreaterThan(0);
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
    await expect(canvas.queryByText("0 referencias")).not.toBeInTheDocument();
  },
};

export const CausasYEvidenciaExactas: Story = {
  name: "Causas y evidencia sin traducción especulativa",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("verified_prepayment_required")).toBeVisible();
    await expect(canvas.getByText("settlement_date_mismatch")).toBeVisible();
    await expect(canvas.getByText("verified_product_terms_required")).toBeVisible();
    await expect(canvas.getByText("fixture:evidence:working-capital")).toBeVisible();
    await expect(canvas.getByText("fixture:evidence:fx")).toBeVisible();
  },
};
