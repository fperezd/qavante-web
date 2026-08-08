import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { FlujoCajaWidget } from "./flujo-caja-widget";

/* FlujoCajaWidget — flujo REAL (entró/salió/neto) por mes cerrado. NO es el proyectado. */

const meta = {
  title: "Propuestas / Inicio v2 / FlujoCajaWidget",
  component: FlujoCajaWidget,
  parameters: { layout: "padded" },
  args: {
    data: {
      meses: [
        {
          periodo: "2026-05",
          mesLabel: "mayo",
          ingresos: 4000000,
          egresos: 4500000,
          neto: -500000,
        },
        {
          periodo: "2026-06",
          mesLabel: "junio",
          ingresos: 5200000,
          egresos: 3100000,
          neto: 2100000,
        },
        {
          periodo: "2026-07",
          mesLabel: "julio",
          ingresos: 6000000,
          egresos: 3500000,
          neto: 2500000,
        },
      ],
      ultimo: {
        periodo: "2026-07",
        mesLabel: "julio",
        ingresos: 6000000,
        egresos: 3500000,
        neto: 2500000,
      },
    },
  },
} satisfies Meta<typeof FlujoCajaWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Flujo de caja")).toBeInTheDocument();
    await expect(c.getByText(/Lo que entró y salió/i)).toBeInTheDocument();
    // Más nuevo arriba: julio con neto positivo.
    await expect(c.getByText("julio")).toBeInTheDocument();
    await expect(c.getByText("+$2.500.000")).toBeInTheDocument();
    // Mes negativo se muestra en rojo con signo menos.
    await expect(c.getByText("−$500.000")).toBeInTheDocument();
    await expect(c.getByText(/Entró \$6\.000\.000 · Salió \$3\.500\.000/)).toBeInTheDocument();
  },
};
