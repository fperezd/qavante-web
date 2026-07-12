import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CajaProyeccion } from "./caja-proyeccion";

const meta = {
  title: "Inicio v2 / CajaProyeccion",
  component: CajaProyeccion,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Caja hoy + proyectada + brecha en UNA card (antes eran 3): saldo, curva proyectada con línea de cero, y mínimas a 14/30 días + días de caja.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaProyeccion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crisis: Story = {
  args: {
    cajaHoy: -1_518_883,
    subtitulo: "Caja hoy · estimada",
    serie: [2_000_000, 1_100_000, 0, -1_518_883, -3_100_000, -4_500_000, -5_737_505],
    filas: [
      { label: "Mínima a 14 días", valor: "−$5.737.505", tono: "neg" },
      { label: "Mínima a 30 días", valor: "−$5.737.505", tono: "neg" },
      { label: "Días de caja", valor: "~0", tono: "neg" },
    ],
    stamp: "Caja hoy · Actualizado 08-07 20:00 · banco",
  },
};

export const Sana: Story = {
  args: {
    cajaHoy: 28_400_000,
    subtitulo: "Caja hoy · 3,2 meses de autonomía",
    serie: [12_000_000, 15_000_000, 18_000_000, 21_000_000, 24_000_000, 26_500_000, 28_400_000],
    filas: [
      { label: "Mínima a 30 días", valor: "$19.200.000", tono: "pos" },
      { label: "Días de caja", valor: "96", tono: "pos" },
      { label: "Colchón objetivo", valor: "✓ cubierto", tono: "pos" },
    ],
    stamp: "Caja hoy · Actualizado hoy · banco",
  },
};

export const Interaccion: Story = {
  name: "Saldo y mínimas",
  args: { ...Crisis.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("−$1.518.883")).toBeInTheDocument();
    await expect(canvas.getByText("Días de caja")).toBeInTheDocument();
  },
};
