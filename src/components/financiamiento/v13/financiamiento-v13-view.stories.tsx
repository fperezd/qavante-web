import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { financingV13Model } from "./financiamiento-v13-model";
import {
  evaluationAbstenidaV13,
  evaluationV13,
  overviewAbstenidoV13,
  overviewCompletoV13,
  overviewParcialV13,
} from "./financiamiento-v13-fixtures";
import { FinanciamientoV13View } from "./financiamiento-v13-view";

const meta = {
  title: "Rediseño F3 / V13 Financiamiento",
  component: FinanciamientoV13View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "V13 muestra deuda, costo y cupo sólo desde el read model canónico. Las referencias no son ofertas y la abstención nunca se convierte en cero.",
      },
    },
  },
} satisfies Meta<typeof FinanciamientoV13View>;

export default meta;
type Story = StoryObj<typeof meta>;
const PRINCIPAL_LABEL = /\$8\.503\.076/;

export const Completo: Story = {
  args: { model: financingV13Model(overviewCompletoV13, evaluationV13) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(PRINCIPAL_LABEL).length).toBeGreaterThanOrEqual(1);
    await expect(canvas.getAllByText("$3.000.000").length).toBeGreaterThanOrEqual(1);
    await expect(canvas.getAllByText("Referencia indicativa").length).toBeGreaterThanOrEqual(1);
    await expect(canvas.getByText("Comparar refinanciamiento")).toBeInTheDocument();
    await expect(canvas.getByText("Ver cuotas")).toBeInTheDocument();
    await expect(canvas.queryByText("Garantía combinada")).not.toBeInTheDocument();
  },
};

export const Parcial: Story = {
  args: { model: financingV13Model(overviewParcialV13, evaluationV13) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Por qué no sabemos tasa" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Por qué no sabemos cupo disponible" }),
    ).toBeInTheDocument();
  },
};

export const Abstenido: Story = {
  args: { model: financingV13Model(overviewAbstenidoV13, null) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Faltan datos de algunos préstamos.")).toBeInTheDocument();
    await expect(canvas.getByText("No hay préstamos para mostrar.")).toBeInTheDocument();
    await expect(canvas.queryByText(PRINCIPAL_LABEL)).not.toBeInTheDocument();
  },
};

export const EvaluacionAbstenida: Story = {
  args: { model: financingV13Model(overviewParcialV13, evaluationAbstenidaV13) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/Estado de la evaluación/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Falta deuda verificada/)).not.toBeInTheDocument();
    await expect(canvas.getAllByText("Referencia indicativa").length).toBeGreaterThanOrEqual(1);
  },
};
