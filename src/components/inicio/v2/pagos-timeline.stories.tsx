import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { PagosTimeline } from "./pagos-timeline";

/* Los 3 vencimientos críticos del mes SIEMPRE visibles con su fecha, y cada uno
   clasificado por postergabilidad — así "reprogramar pagos" usa solo lo negociable. */

const meta = {
  title: "Inicio v2 / PagosTimeline",
  component: PagosTimeline,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Pagos críticos vencidos y próximos: fechas siempre presentes + tag de postergabilidad (no postergable / negociable / postergable / cubierto).",
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
} satisfies Meta<typeof PagosTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crisis: Story = {
  args: {
    total: 16_614_448,
    totalEnRojo: true,
    subtitulo: "Vencidos o exigibles durante los próximos 14 días",
    pagos: [
      { fecha: "Venció 30-06", nombre: "Remuneraciones", monto: 8_600_000, tipo: "no_postergable", vencido: true },
      { fecha: "Vence día 20", nombre: "IVA / F29", monto: 4_214_448, tipo: "no_postergable" },
      { fecha: "Próx. 14 días", nombre: "Proveedores", monto: 3_800_000, tipo: "negociable" },
    ],
  },
};

export const Sana: Story = {
  args: {
    total: 14_200_000,
    subtitulo: "Cubiertos por la caja proyectada a su fecha de vencimiento",
    pagos: [
      { fecha: "Vence 30", nombre: "Remuneraciones", monto: 8_600_000, tipo: "cubierto" },
      { fecha: "Vence día 20", nombre: "IVA / F29", monto: 4_200_000, tipo: "cubierto" },
      { fecha: "Próx. 14 días", nombre: "Proveedores", monto: 1_400_000, tipo: "cubierto" },
    ],
  },
};

export const Interaccion: Story = {
  name: "Fechas y postergabilidad visibles",
  args: { ...Crisis.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La fecha del pago vencido está presente y etiquetada como tal.
    await expect(canvas.getByText("Venció 30-06")).toBeInTheDocument();
    // La clasificación distingue lo no postergable (2 ítems) de lo negociable.
    await expect(canvas.getAllByText("No postergable")).toHaveLength(2);
    await expect(canvas.getByText("Negociable")).toBeInTheDocument();
    // Monto con el símbolo correcto de la casa.
    await expect(canvas.getByText("$8.600.000")).toBeInTheDocument();
  },
};
