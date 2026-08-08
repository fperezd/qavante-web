import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { MargenesWidget } from "./margenes-widget";

/* MargenesWidget — margen bruto y neto del mes cerrado. */

const meta = {
  title: "Propuestas / Inicio v2 / MargenesWidget",
  component: MargenesWidget,
  parameters: { layout: "padded" },
  args: {
    data: {
      mesLabel: "julio",
      ingresos: 10000000,
      brutoMonto: 4000000,
      brutoPct: 40,
      netoMonto: 1500000,
      netoPct: 15,
      confiable: true,
    },
  },
} satisfies Meta<typeof MargenesWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Márgenes")).toBeInTheDocument();
    await expect(c.getByText("40%")).toBeInTheDocument();
    await expect(c.getByText("15%")).toBeInTheDocument();
    await expect(c.getByText(/De cada \$100 vendidos/i)).toBeInTheDocument();
  },
};

export const Perdida: Story = {
  args: {
    data: {
      mesLabel: "junio",
      ingresos: 5000000,
      brutoMonto: 1000000,
      brutoPct: 20,
      netoMonto: -1000000,
      netoPct: -20,
      confiable: true,
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("−20%")).toBeInTheDocument();
  },
};
