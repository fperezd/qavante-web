import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CobranzaRealizable } from "./cobranza-realizable";

/* Lidera con lo realizable a tiempo (por comportamiento de pago), no con el total. */

const meta = {
  title: "Inicio v2 / CobranzaRealizable",
  component: CobranzaRealizable,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Cobranza esperada a tiempo, segmentada por probabilidad de pago (motor DSO/DPO). El total por cobrar queda secundario; $0 vencido se muestra en verde.",
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
} satisfies Meta<typeof CobranzaRealizable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crisis: Story = {
  args: {
    esperadoATiempo: 7_800_000,
    subtitulo: "Cobranza esperada a tiempo · próximos 14 días",
    totalPorCobrar: 205_400_000,
    vencido: 0,
    segmentos: [
      { label: "Alta prob. — pagan a tiempo", monto: 7_800_000, banda: "high" },
      { label: "Probable — pago irregular", monto: 4_300_000, banda: "probable" },
      { label: "Sin patrón de pago claro", monto: 6_100_000, banda: "unknown" },
    ],
  },
};

export const Interaccion: Story = {
  name: "Realizable lidera, total secundario",
  args: { ...Crisis.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El realizable ($7,8M) = la banda de alta prob → aparece como cifra grande y como segmento.
    await expect(canvas.getAllByText("$7.800.000")).toHaveLength(2);
    await expect(canvas.getByText(/Total por cobrar/)).toBeInTheDocument();
    await expect(canvas.getByText("$0 vencido")).toBeInTheDocument();
  },
};

export const VencidoSinDato: Story = {
  name: "Vencido sin dato (SII sin vencimientos)",
  args: { ...Crisis.args!, vencido: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // No debe decir "$0 vencido" (mentiría "al día"); dice "sin dato de vencido".
    await expect(canvas.queryByText("$0 vencido")).not.toBeInTheDocument();
    await expect(canvas.getByText(/sin dato de vencido/)).toBeInTheDocument();
  },
};
