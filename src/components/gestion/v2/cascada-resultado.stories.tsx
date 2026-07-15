import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CascadaResultado } from "./cascada-resultado";
import type { CascadaEntrada } from "./cascada-model";

/* La cascada del resultado (waterfall) de Gestión v2: el P&L del mes como barras flotantes. */

const meta = {
  title: "Propuestas / Gestión / CascadaResultado",
  component: CascadaResultado,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ maxWidth: 820 }}><Story /></div>],
} satisfies Meta<typeof CascadaResultado>;

export default meta;
type Story = StoryObj<typeof meta>;

const PNL: CascadaEntrada[] = [
  { id: "ing", label: "Ingresos", tipo: "ingreso", monto: 48_200_000 },
  { id: "cd", label: "Costos directos", tipo: "resta", monto: 21_400_000 },
  { id: "mb", label: "Margen bruto", tipo: "subtotal", monto: 0, pct: 55.6 },
  { id: "gl", label: "Gasto laboral", tipo: "resta", monto: 14_900_000 },
  { id: "ho", label: "Honorarios", tipo: "resta", monto: 2_300_000 },
  { id: "gr", label: "Gastos recurrentes", tipo: "resta", monto: 5_100_000 },
  { id: "res", label: "Resultado operacional", tipo: "resultado", monto: 0, pct: 9.3 },
];

export const Ganancia: Story = {
  args: { entradas: PNL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Ingresos")).toBeInTheDocument();
    await expect(canvas.getByText("$48.200.000")).toBeInTheDocument();
    // Restas en negativo (U+2212).
    await expect(canvas.getByText("−$21.400.000")).toBeInTheDocument();
    // "Resultado operacional" aparece como título y como fila final.
    expect(canvas.getAllByText("Resultado operacional").length).toBeGreaterThanOrEqual(2);
    await expect(canvas.getByText("$4.500.000")).toBeInTheDocument();
    // Margen bruto y margen neto en %.
    await expect(canvas.getByText("55,6%")).toBeInTheDocument();
    await expect(canvas.getByText("9,3%")).toBeInTheDocument();
  },
};

/** Mes con pérdida: el resultado va en rojo. */
export const Perdida: Story = {
  args: {
    entradas: [
      { id: "ing", label: "Ingresos", tipo: "ingreso", monto: 18_000_000 },
      { id: "cd", label: "Costos directos", tipo: "resta", monto: 12_000_000 },
      { id: "mb", label: "Margen bruto", tipo: "subtotal", monto: 0, pct: 33.3 },
      { id: "gl", label: "Gasto laboral", tipo: "resta", monto: 9_000_000 },
      { id: "res", label: "Resultado operacional", tipo: "resultado", monto: 0, pct: -16.7 },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("−$3.000.000")).toBeInTheDocument();
  },
};
