import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { PuntoEquilibrioWidget } from "./punto-equilibrio-widget";

/* PuntoEquilibrioWidget — el piso concreto de venta = lo que gastaste el último mes cerrado. */

const meta = {
  title: "Propuestas / Inicio v2 / PuntoEquilibrioWidget",
  component: PuntoEquilibrioWidget,
  parameters: { layout: "padded" },
  args: {
    data: {
      lineas: [
        { label: "Remuneraciones", codigo: "5101", monto: 8000000 },
        { label: "Arriendo", codigo: "5201", monto: 2000000 },
      ],
      totalACubrir: 10000000,
      ingresoMes: 12000000,
      mes: "2026-06",
    },
  },
} satisfies Meta<typeof PuntoEquilibrioWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cubierto: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Punto de equilibrio")).toBeInTheDocument();
    await expect(c.getByText("$10.000.000")).toBeInTheDocument();
    await expect(c.getByText(/cubriste el piso/i)).toBeInTheDocument();
  },
};

export const NoCubierto: Story = {
  args: {
    data: {
      lineas: [{ label: "Remuneraciones", codigo: "5101", monto: 8000000 }],
      totalACubrir: 8000000,
      ingresoMes: 5000000,
      mes: "2026-06",
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/te faltaron \$3\.000\.000/i)).toBeInTheDocument();
  },
};
