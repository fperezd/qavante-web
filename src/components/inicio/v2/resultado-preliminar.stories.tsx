import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { ResultadoPreliminar } from "./resultado-preliminar";

/* Margen agregado marcado preliminar con rango del peor caso; señales de gestión
   del SII (costo que más creció, concentración). Sin margen por cliente/producto. */

const meta = {
  title: "Inicio v2 / ResultadoPreliminar",
  component: ResultadoPreliminar,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Resultado + margen operacional agregado, marcado preliminar cuando faltan clasificar costos, con rango worst-case. Nada de margen por cliente (no hay costeo).",
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
} satisfies Meta<typeof ResultadoPreliminar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preliminar: Story = {
  args: {
    resultado: 7_926_679,
    subtitulo: "Resultado operacional · julio",
    ingresos: 8_855_032,
    margenLabel: "Margen operacional preliminar",
    margen: "89%",
    caveat: "Puede cambiar al completar 195 movimientos por clasificar · impacto máx. pendiente $3,4M",
    rango: "entre 51% y 89%",
    extra: [
      { label: "Costo que más creció", valor: "Servicios +18%", tono: "warn" },
      { label: "Concentración de ventas", valor: "1 cliente · 38%" },
    ],
  },
};

export const Sana: Story = {
  args: {
    resultado: 12_400_000,
    subtitulo: "Resultado operacional · ↑12% vs mes anterior",
    ingresos: 29_500_000,
    margenLabel: "Margen operacional",
    margen: "42%",
    extra: [
      { label: "Costo que más creció", valor: "Sin alzas relevantes" },
      { label: "Concentración de ventas", valor: "1 cliente · 38%" },
    ],
  },
};

export const Perdida: Story = {
  name: "Resultado negativo (pérdida)",
  args: {
    resultado: -1_240_000,
    subtitulo: "Resultado operacional · julio",
    ingresos: 8_000_000,
    margenLabel: "Margen operacional preliminar",
    margen: "−16%",
    caveat: "Puede cambiar al completar 195 movimientos por clasificar",
    extra: [{ label: "Costo que más creció", valor: "Servicios +18%", tono: "warn" }],
  },
};

export const Interaccion: Story = {
  name: "Preliminar + rango honesto",
  args: { ...Preliminar.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Margen operacional preliminar")).toBeInTheDocument();
    await expect(canvas.getByText("entre 51% y 89%")).toBeInTheDocument();
    await expect(canvas.getByText(/impacto máx. pendiente/)).toBeInTheDocument();
  },
};

export const PerdidaEnRojo: Story = {
  name: "Una pérdida NO se ve verde",
  args: { ...Perdida.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La cifra grande de una pérdida va en rojo (danger), nunca en verde.
    const cifras = canvas.getAllByText("−$1.240.000");
    const grande = cifras.find((el) => el.className.includes("text-2xl"));
    await expect(grande).toBeTruthy();
    await expect(grande!.className).toContain("text-danger-500");
    await expect(grande!.className).not.toContain("text-success-700");
  },
};
