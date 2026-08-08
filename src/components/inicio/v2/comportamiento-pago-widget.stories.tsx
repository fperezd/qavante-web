import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { ComportamientoPagoWidget } from "./comportamiento-pago-widget";

/* ComportamientoPagoWidget — cuántos días pagan tus clientes vs el vencimiento (diferenciador). */

const meta = {
  title: "Propuestas / Inicio v2 / ComportamientoPagoWidget",
  component: ComportamientoPagoWidget,
  parameters: { layout: "padded" },
  args: { data: { shiftDays: 8, docsComportamiento: 30, docsVencimiento: 5 } },
} satisfies Meta<typeof ComportamientoPagoWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaganDespues: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Comportamiento de pago")).toBeInTheDocument();
    await expect(c.getByText("+8 días")).toBeInTheDocument();
    await expect(c.getByText(/8 días después/i)).toBeInTheDocument();
  },
};

export const PaganAntes: Story = {
  args: { data: { shiftDays: -3, docsComportamiento: 10, docsVencimiento: 0 } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("−3 días")).toBeInTheDocument();
    await expect(c.getByText(/3 días antes/i)).toBeInTheDocument();
  },
};
