import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { RemuneracionesWidget } from "./remuneraciones-widget";

/* RemuneracionesWidget — líquido de la planilla + dotación + cotizaciones. */

const meta = {
  title: "Propuestas / Inicio v2 / RemuneracionesWidget",
  component: RemuneracionesWidget,
  parameters: { layout: "padded" },
  args: {
    data: { mesLabel: "julio", liquido: 8500000, empleados: 12, cotizaciones: 4180500 },
  },
} satisfies Meta<typeof RemuneracionesWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Remuneraciones")).toBeInTheDocument();
    await expect(c.getByText("$8.500.000")).toBeInTheDocument();
    await expect(c.getByText("12")).toBeInTheDocument();
    await expect(c.getByText(/Cotizaciones \(Previred\)/i)).toBeInTheDocument();
  },
};
