import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { VencimientosTimeline } from "./vencimientos-timeline";

/* "Por vencer y vencidos": pagos por urgencia con su postergabilidad, clickeables. */

const meta = {
  title: "Propuestas / Pagar / VencimientosTimeline",
  component: VencimientosTimeline,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VencimientosTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const PorUrgencia: Story = {
  args: {
    items: [
      // Con onClick (drill-down cableado por el container) → clickeable.
      { id: "1", vencido: true, fecha: "10-07", acreedor: "COMERCIAL KAUFMANN S.A.", detalle: "Proveedor · factura 8842", monto: 2_100_000, postergabilidad: "negociable", onClick: noop },
      { id: "2", fecha: "13-07", acreedor: "Previred — cotizaciones", detalle: "Leyes sociales · junio", monto: 3_850_000, postergabilidad: "no_postergable", onClick: noop },
      { id: "3", fecha: "15-07", acreedor: "Google Cloud", detalle: "Servicio · compra extranjera", monto: 1_190_000, montoOrigen: "US$1.240", postergabilidad: "negociable", onClick: noop },
      { id: "4", fecha: "20-07", acreedor: "F29 — IVA a pagar", detalle: "Impuesto SII · junio", monto: 4_200_000, postergabilidad: "no_postergable", onClick: noop },
      { id: "5", fecha: "25-07", acreedor: "DIVEIMPORT S.A.", detalle: "Proveedor · factura 1043", monto: 3_400_000, postergabilidad: "cubierto", onClick: noop },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Con onClick → clickeable (botón con acceso al detalle).
    await expect(canvas.getByRole("button", { name: /COMERCIAL KAUFMANN/ })).toBeInTheDocument();
    // Postergabilidades.
    await expect(canvas.getAllByText("No postergable")).toHaveLength(2);
    await expect(canvas.getByText("Cubierto")).toBeInTheDocument();
    // Multimoneda: USD de origen visible.
    await expect(canvas.getByText("US$1.240")).toBeInTheDocument();
  },
};

/** Sin onClick (ítems sin destino todavía): NO se renderean como botones (sin afordance no-op). */
export const SinDestino: Story = {
  args: {
    items: [
      { id: "1", fecha: "20-07", acreedor: "F29 — IVA a pagar", detalle: "Impuesto SII", monto: 4_200_000, postergabilidad: "no_postergable" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("F29 — IVA a pagar")).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
