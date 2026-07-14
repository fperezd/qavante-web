import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { SaldoPorBanco } from "./saldo-por-banco";

/* Saldo de hoy resumido por banco (escala a muchas cuentas); cada banco → su detalle. */

const meta = {
  title: "Propuestas / Caja / SaldoPorBanco",
  component: SaldoPorBanco,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360, border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SaldoPorBanco>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CuatroBancos: Story = {
  args: {
    titulo: "Saldo por banco · 10 cuentas",
    bancos: [
      { banco: "BICE", saldo: 8_900_000, detalle: "3 cuentas · CLP + USD" },
      { banco: "Santander", saldo: 5_200_000, detalle: "4 cuentas" },
      { banco: "BCI", saldo: 3_100_000, detalle: "2 cuentas" },
      { banco: "Banco Estado", saldo: 1_200_000, detalle: "1 cuenta" },
    ],
    total: 18_400_000,
    totalLabel: "Total · 4 bancos",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Cada banco con su saldo, clickeable.
    await expect(canvas.getByRole("button", { name: /BICE/ })).toBeInTheDocument();
    await expect(canvas.getByText("$8.900.000")).toBeInTheDocument();
    await expect(canvas.getByText("Banco Estado")).toBeInTheDocument();
    // El total consolidado.
    await expect(canvas.getByText("Total · 4 bancos")).toBeInTheDocument();
    await expect(canvas.getByText("$18.400.000")).toBeInTheDocument();
  },
};

export const Vacio: Story = {
  args: { bancos: [], total: 0, totalLabel: "Total" },
};

/** Degradado: sin el detalle por banco (bice/saldo api-key-only), se muestra el total + un
 *  aviso honesto para conectar el banco. */
export const SinBanco: Story = {
  args: {
    titulo: "Saldo disponible",
    bancos: [],
    total: -5_905_530,
    totalLabel: "Total en caja hoy",
    nota: "Conectá tu banco para ver el saldo por cuenta",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Conectá tu banco/)).toBeInTheDocument();
    await expect(canvas.getByText("−$5.905.530")).toBeInTheDocument();
  },
};
