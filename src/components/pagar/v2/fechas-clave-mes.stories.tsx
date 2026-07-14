import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { FechasClaveMes } from "./fechas-clave-mes";

/* Las 3 obligaciones canónicas del mes (imposiciones · IVA · sueldos), destacadas. */

const meta = {
  title: "Propuestas / Pagar / FechasClaveMes",
  component: FechasClaveMes,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ maxWidth: 820 }}><Story /></div>],
} satisfies Meta<typeof FechasClaveMes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TresDelMes: Story = {
  args: {
    total: 16_950_000,
    items: [
      { id: "imp", label: "Imposiciones · Previred", monto: 3_850_000, vence: "13-jul", enDias: 1, icono: "imposiciones" },
      { id: "iva", label: "Impuestos · F29 (IVA)", monto: 4_200_000, vence: "20-jul", enDias: 6, icono: "impuestos" },
      { id: "sue", label: "Sueldos · 6 empleados", monto: 8_900_000, vence: "30-jul", enDias: 16, icono: "sueldos" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Imposiciones · Previred")).toBeInTheDocument();
    await expect(canvas.getByText("$4.200.000")).toBeInTheDocument();
    await expect(canvas.getByText(/Suman/)).toBeInTheDocument();
    await expect(canvas.getByText(/en 1 día/)).toBeInTheDocument();
  },
};

/* F29 estimado (antes de que el SII lo emita) + una obligación ya vencida: el badge
   "Estimación" y el texto "venció hace N días" (no "en −N días"). */
export const EstimadoYVencido: Story = {
  args: {
    total: 12_750_000,
    items: [
      { id: "imp", label: "Imposiciones · Previred", monto: 3_850_000, vence: "30-jun", enDias: -14, icono: "imposiciones" },
      { id: "iva", label: "Impuestos · F29 (IVA)", monto: 4_200_000, vence: "20-jul", enDias: 6, icono: "impuestos", estimado: true },
      { id: "sue", label: "Sueldos · 6 empleados", monto: 8_900_000, vence: "30-jul", enDias: 16, icono: "sueldos" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // F29 marcado como estimación.
    await expect(canvas.getByText("Estimación")).toBeInTheDocument();
    // El vencido dice "venció hace N días", no "en −N días".
    await expect(canvas.getByText(/hace 14 días/)).toBeInTheDocument();
    await expect(canvas.queryByText(/en -14/)).not.toBeInTheDocument();
  },
};
