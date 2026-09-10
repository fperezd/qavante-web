import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { simulationSuggestions, simuladorV14Model } from "./simulador-v14-model";
import {
  simulationAbstainedV14,
  simulationPartialV14,
  simulationReadyV14,
  simulationStaleV14,
} from "./simulador-v14-fixtures";
import { SimuladorV14View } from "./simulador-v14-view";

const suggestions = simulationSuggestions("2026-09-09T12:00:00Z", "CLP");
const meta = {
  title: "Rediseño F3 / V14 Simulador",
  component: SimuladorV14View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "V14 evalúa supuestos contra el motor canónico. El frontend sólo presenta el memo y nunca persiste, ejecuta ni recompone cifras.",
      },
    },
  },
  args: { suggestions, onEvaluate: () => undefined },
} satisfies Meta<typeof SimuladorV14View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lista: Story = {
  args: { model: simuladorV14Model(simulationReadyV14) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Puedes asumir el gasto, con una condición."),
    ).toBeInTheDocument();
    await expect(canvas.getAllByText("−$2.500.000")).toHaveLength(2);
    await expect(canvas.getAllByText("projection:baseline-2026-09-09")).toHaveLength(2);
  },
};

export const Parcial: Story = {
  args: { model: simuladorV14Model(simulationPartialV14) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Memo · Evaluación parcial")).toBeInTheDocument();
    await expect(canvas.getAllByText("Sin dato").length).toBeGreaterThan(0);
  },
};

export const Abstenida: Story = {
  args: { model: simuladorV14Model(simulationAbstainedV14) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Memo · El motor se abstuvo")).toBeInTheDocument();
  },
};

export const Vencida: Story = {
  args: { model: simuladorV14Model(simulationStaleV14) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Fuentes vencidas")).toBeInTheDocument();
  },
};

export const Vacia: Story = {
  args: { model: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Todavía no hay un memo.")).toBeInTheDocument();
  },
};

export const Cargando: Story = {
  args: { model: null, loading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Contrastando el supuesto/)).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: { model: null, error: "El servicio no respondió." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "El servicio no respondió",
    );
  },
};
