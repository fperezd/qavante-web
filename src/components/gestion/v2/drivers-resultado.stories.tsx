import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { DriversResultado } from "./drivers-resultado";

/* "Qué explica el resultado": los conceptos que más movieron el resultado del mes. */

const meta = {
  title: "Propuestas / Gestión / DriversResultado",
  component: DriversResultado,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ maxWidth: 480 }}><Story /></div>],
} satisfies Meta<typeof DriversResultado>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CuatroDrivers: Story = {
  args: {
    items: [
      { id: "1", direccion: "improves", concepto: "Ventas", impacto: 3_200_000, explicacion: "Las ventas subieron 8% vs. el mes pasado." },
      { id: "2", direccion: "worsens", concepto: "Sueldos", impacto: 1_100_000, explicacion: "Sumaste 1 persona al equipo este mes." },
      { id: "3", direccion: "improves", concepto: "Costo de venta", impacto: 800_000, explicacion: "Mejor margen por mix de productos." },
      { id: "4", direccion: "worsens", concepto: "Honorarios", impacto: 400_000, explicacion: "Asesoría legal puntual (una vez)." },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Ventas")).toBeInTheDocument();
    await expect(canvas.getByText("+$3.200.000")).toBeInTheDocument();
    await expect(canvas.getByText("−$1.100.000")).toBeInTheDocument();
  },
};

export const Vacio: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Sin datos/)).toBeInTheDocument();
  },
};
