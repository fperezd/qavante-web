import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { MultiCurrencyTotalsBreakdown } from "./multi-currency-totals";
import type { MultiCurrencyTotals } from "./multi-currency";

/* Desglose por moneda cuando NO se puede mostrar un total único (INV-FX-001).
   Las historias documentan la regla: con CLP y USD juntos se muestran los dos
   totales por separado y se dice por qué, nunca una suma mezclada. */

const meta = {
  title: "Propuestas / Caja / MultiCurrencyTotalsBreakdown",
  component: MultiCurrencyTotalsBreakdown,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MultiCurrencyTotalsBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

const mezcla: MultiCurrencyTotals = {
  totals: [
    { currency: "CLP", credit: 4_500_000, debit: 1_200_000, net: 3_300_000, count: 12 },
    { currency: "USD", credit: 2_400, debit: 3_100, net: -700, count: 5 },
  ],
  unknownCount: 0,
  count: 17,
  totalizable: false,
  currency: null,
};

/** El caso central: CLP y USD conviven → dos netos, cero suma mezclada. */
export const ClpYUsd: Story = {
  args: { totals: mezcla, label: "Neto del período" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Un neto por moneda, cada uno en su símbolo.
    await expect(canvas.getByText("CLP")).toBeInTheDocument();
    await expect(canvas.getByText("USD")).toBeInTheDocument();
    await expect(canvas.getByText(/3\.300\.000/)).toBeInTheDocument();
    // El motivo, explícito: el usuario tiene que entender que no es un bug.
    await expect(canvas.getByRole("status")).toHaveTextContent(/CLP y USD/);
    await expect(canvas.getByRole("status")).toHaveTextContent(/tipo de cambio/);
    // Y NO existe la suma cruda 3.300.000 + (−700).
    await expect(canvas.queryByText(/3\.299\.300/)).not.toBeInTheDocument();
  },
};

/** Movimientos cuya cuenta no está en la lista (p. ej. desactivada): quedan
 *  fuera del total y se declara cuántos son. */
export const ConMonedaDesconocida: Story = {
  args: {
    totals: {
      totals: [{ currency: "CLP", credit: 900_000, debit: 250_000, net: 650_000, count: 8 }],
      unknownCount: 2,
      count: 10,
      totalizable: false,
      currency: null,
    },
    label: "Neto del período",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(/2 movimientos/);
    await expect(canvas.getByRole("status")).toHaveTextContent(/fuera del total/);
  },
};

/** Nada que totalizar (todos sin moneda conocida): se dice, no se inventa un 0. */
export const SinMonedaConocida: Story = {
  args: {
    totals: { totals: [], unknownCount: 3, count: 3, totalizable: false, currency: null },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    // Sin cifras: no hay "$0" inventado.
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
  },
};
