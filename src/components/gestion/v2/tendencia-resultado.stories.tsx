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
      { periodo: "feb", resultado: 2_800_000 },
      { periodo: "mar", resultado: 3_100_000 },
      { periodo: "abr", resultado: 2_400_000 },
      { periodo: "may", resultado: 3_900_000 },
      { periodo: "jun", resultado: 4_000_000 },
      { periodo: "jul", resultado: 4_500_000, actual: true },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("jul")).toBeInTheDocument();
    await expect(canvas.getByText(/en curso/)).toBeInTheDocument();
  },
};

/** Con un mes en pérdida: la barra va en rojo, bajo el eje 0. */
export const ConPerdida: Story = {
  args: {
    puntos: [
      { periodo: "abr", resultado: 1_200_000 },
      { periodo: "may", resultado: -900_000 },
      { periodo: "jun", resultado: 600_000 },
      { periodo: "jul", resultado: 1_800_000, actual: true },
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
