import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { GanandoDineroWidget } from "./ganando-dinero-widget";

/* GanandoDineroWidget — "¿Estás ganando dinero?" anclado al mes anterior cerrado. */

const meta = {
  title: "Propuestas / Inicio v2 / GanandoDineroWidget",
  component: GanandoDineroWidget,
  parameters: { layout: "padded" },
  args: {
    data: { gano: true, resultado: 16789676, margenPct: 42, mesLabel: "julio", confiable: true },
  },
} satisfies Meta<typeof GanandoDineroWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ganó: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("¿Estás ganando dinero?")).toBeInTheDocument();
    await expect(c.getByText(/en julio \(mes cerrado\)/i)).toBeInTheDocument();
    await expect(c.getByText(/ganó \$16\.789\.676/)).toBeInTheDocument();
    await expect(c.getByText(/Margen operacional 42%/)).toBeInTheDocument();
    // Honestidad: aclara que NO es el mes en curso.
    await expect(c.getByText(/no es el mes en curso/i)).toBeInTheDocument();
  },
};

export const Perdió: Story = {
  args: {
    data: { gano: false, resultado: -3200000, margenPct: -8, mesLabel: "junio", confiable: true },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/perdió \$3\.200\.000/)).toBeInTheDocument();
  },
};
