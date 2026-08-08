import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { SaldosBancoWidget } from "./saldos-banco-widget";

/* SaldosBancoWidget — total en pesos + saldo por cuenta. */

const meta = {
  title: "Propuestas / Inicio v2 / SaldosBancoWidget",
  component: SaldosBancoWidget,
  parameters: { layout: "padded" },
  args: {
    data: {
      totalClp: 6500000,
      cuentas: [
        { nombre: "Cuenta Corriente", numero: "0012-3", moneda: "CLP", saldo: 5000000, extranjera: false },
        { nombre: "Vista", numero: "0045-6", moneda: "CLP", saldo: 1500000, extranjera: false },
        { nombre: "USD", numero: "0078-9", moneda: "USD", saldo: 2000, extranjera: true },
      ],
    },
  },
} satisfies Meta<typeof SaldosBancoWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Saldos en banco")).toBeInTheDocument();
    await expect(c.getByText("Cuenta Corriente")).toBeInTheDocument();
    await expect(c.getByText("$6.500.000")).toBeInTheDocument();
  },
};
