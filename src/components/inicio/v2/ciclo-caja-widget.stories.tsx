import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CicloCajaWidget } from "./ciclo-caja-widget";

/* CicloCajaWidget — cobras en X, pagas en Y, ciclo Z, en lenguaje de dueño. */

const meta = {
  title: "Propuestas / Inicio v2 / CicloCajaWidget",
  component: CicloCajaWidget,
  parameters: { layout: "padded" },
  args: { data: { dso: 45, dpo: 30, ccc: 15 } },
} satisfies Meta<typeof CicloCajaWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CicloPositivo: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Ciclo de caja")).toBeInTheDocument();
    await expect(c.getByText("45")).toBeInTheDocument();
    await expect(c.getByText(/queda ~15 días atrapada/i)).toBeInTheDocument();
  },
};

export const CicloNegativo: Story = {
  args: { data: { dso: 20, dpo: 35, ccc: -15 } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/15 días de aire/i)).toBeInTheDocument();
  },
};
