import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CajaCascada } from "./caja-cascada";
import type { MovimientoCaja } from "./caja-cascada-model";

/* La cascada de caja del Caja v3: de "saldo hoy" a "proyectado", con cada movimiento en su FECHA
   moviendo el saldo corriente. Cronológica (a diferencia de la del P&L, que es por categoría).
   El saldo corriente se hunde y qué cobranza lo rescata quedan a la vista. Presentacional puro. */

const mov = (fecha: string, fechaLabel: string, label: string, monto: number): MovimientoCaja => ({
  fecha: new Date(fecha),
  fechaLabel,
  label,
  monto,
});

const meta = {
  title: "Propuestas / Caja / CajaCascada",
  component: CajaCascada,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 760,
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaCascada>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConPisoNegativo: Story = {
  args: {
    saldoHoy: 6_200_000,
    movimientos: [
      mov("2026-07-30", "30-jul", "Sueldos", -6_800_000),
      mov("2026-08-05", "5-ago", "Kaufmann", 2_900_000),
      mov("2026-08-10", "10-ago", "Proveedores", -5_100_000),
      mov("2026-08-20", "20-ago", "F29", -1_800_000),
      mov("2026-08-25", "25-ago", "Cliente B", 6_900_000),
    ],
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // anclas + movimientos por fecha
    await expect(c.getByText("Saldo hoy")).toBeInTheDocument();
    await expect(c.getByText("Sueldos")).toBeInTheDocument();
    await expect(c.getByText("Kaufmann")).toBeInTheDocument();
    await expect(c.getByText("Proyectado")).toBeInTheDocument();
    await expect(c.getByText("30-jul")).toBeInTheDocument();
    // el camino toca negativo → marca el piso
    await expect(c.getByText("piso")).toBeInTheDocument();
  },
};

export const SiempreEnVerde: Story = {
  args: {
    saldoHoy: 12_000_000,
    movimientos: [
      mov("2026-07-30", "30-jul", "Sueldos", -3_500_000),
      mov("2026-08-05", "5-ago", "Cobranzas", 4_200_000),
      mov("2026-08-20", "20-ago", "F29", -1_800_000),
    ],
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Proyectado")).toBeInTheDocument();
    // nunca toca negativo → sin marca de piso
    await expect(c.queryByText("piso")).toBeNull();
  },
};
