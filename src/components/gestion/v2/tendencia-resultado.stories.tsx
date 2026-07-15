import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { TendenciaResultado } from "./tendencia-resultado";

/* El resultado operacional de los últimos meses: ¿voy mejorando o empeorando? */

const meta = {
  title: "Propuestas / Gestión / TendenciaResultado",
  component: TendenciaResultado,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ maxWidth: 440 }}><Story /></div>],
} satisfies Meta<typeof TendenciaResultado>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Creciendo: Story = {
  args: {
    puntos: [
      { periodo: "feb", margenPct: 6.5, resultado: 2_800_000 },
      { periodo: "mar", margenPct: 7.0, resultado: 3_100_000 },
      { periodo: "abr", margenPct: 5.2, resultado: 2_400_000 },
      { periodo: "may", margenPct: 8.4, resultado: 3_900_000 },
      { periodo: "jun", margenPct: 8.6, resultado: 4_000_000 },
      { periodo: "jul", margenPct: 9.3, resultado: 4_500_000, actual: true },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("jul")).toBeInTheDocument();
    await expect(canvas.getByText(/en curso/)).toBeInTheDocument();
    // "9,3%" aparece en la barra del mes en curso y en el pie ("Último mes …").
    expect(canvas.getAllByText(/9,3%/).length).toBeGreaterThanOrEqual(1);
  },
};

/** Con un mes en pérdida: margen negativo → barra roja, bajo el eje 0. */
export const ConPerdida: Story = {
  args: {
    puntos: [
      { periodo: "abr", margenPct: 4.1, resultado: 1_200_000 },
      { periodo: "may", margenPct: -3.2, resultado: -900_000 },
      { periodo: "jun", margenPct: 2.0, resultado: 600_000 },
      { periodo: "jul", margenPct: 6.0, resultado: 1_800_000, actual: true },
    ],
  },
};

export const Vacio: Story = {
  args: { puntos: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Sin histórico/)).toBeInTheDocument();
  },
};
