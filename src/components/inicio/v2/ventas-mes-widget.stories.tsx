import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { VentasMesWidget } from "./ventas-mes-widget";

/* VentasMesWidget — tendencia del neto vendido mes a mes. */

const meta = {
  title: "Propuestas / Inicio v2 / VentasMesWidget",
  component: VentasMesWidget,
  parameters: { layout: "padded" },
  args: {
    data: {
      meses: [
        { periodo: "2026-04", mesLabel: "abril", neto: 7000000 },
        { periodo: "2026-05", mesLabel: "mayo", neto: 8000000 },
        { periodo: "2026-06", mesLabel: "junio", neto: 10000000 },
        { periodo: "2026-07", mesLabel: "julio", neto: 12000000 },
      ],
      ultimo: { periodo: "2026-07", mesLabel: "julio", neto: 12000000 },
      variacionPct: 20,
    },
  },
} satisfies Meta<typeof VentasMesWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Subiendo: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Ventas por mes")).toBeInTheDocument();
    await expect(c.getByText("julio")).toBeInTheDocument();
    await expect(c.getByText("+20%")).toBeInTheDocument();
  },
};

export const Bajando: Story = {
  args: {
    data: {
      meses: [
        { periodo: "2026-06", mesLabel: "junio", neto: 12000000 },
        { periodo: "2026-07", mesLabel: "julio", neto: 9000000 },
      ],
      ultimo: { periodo: "2026-07", mesLabel: "julio", neto: 9000000 },
      variacionPct: -25,
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("−25%")).toBeInTheDocument();
  },
};
