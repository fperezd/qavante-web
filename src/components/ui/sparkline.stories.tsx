import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Sparkline } from "./sparkline";

/* Sparkline — mini-tendencia SVG (primitivo transversal: Libro, Inicio, Caja, Cartola…). Área con
   degradado, línea suavizada (bezier), trazado animado (draw-in) y punto final con halo. */

const meta = {
  title: "UI / Sparkline",
  component: Sparkline,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ padding: 20, background: "var(--color-surface)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

const SERIE = [8, 6, 7, 5, 9, 11, 10, 13, 12, 15, 14, 17];
const CRUZA = [4, 2, 3, -1, -2, 1, 3, 5, 4, 6];

export const Brand: Story = {
  args: { data: SERIE, tone: "brand", width: 160, height: 48 },
};

export const ConMinMax: Story = {
  args: { data: SERIE, tone: "success", width: 160, height: 48, markers: true },
};

export const CruzaBaseline: Story = {
  args: { data: CRUZA, tone: "danger", width: 160, height: 48, baseline: 0, markers: true },
};

export const Neutral: Story = {
  args: { data: [5, 5, 5, 6, 5, 5], tone: "neutral", width: 160, height: 48 },
};
