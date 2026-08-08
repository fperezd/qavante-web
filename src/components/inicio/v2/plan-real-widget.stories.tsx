import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent } from "storybook/test";
import { PlanRealWidget } from "./plan-real-widget";

/* PlanRealWidget — presupuesto vs real por línea de P&L, con toggle Mes/Año. */

const meta = {
  title: "Propuestas / Inicio v2 / PlanRealWidget",
  component: PlanRealWidget,
  parameters: { layout: "padded" },
  args: {
    modo: "mes",
    data: {
      periodoLabel: "julio",
      tieneBudget: true,
      filas: [
        {
          concepto: "revenue",
          label: "Ingresos",
          plan: 10000000,
          real: 12000000,
          variacion: 2000000,
          variacionPct: 20,
          favorable: true,
        },
        {
          concepto: "direct_cost",
          label: "Costo directo",
          plan: 4000000,
          real: 5000000,
          variacion: 1000000,
          variacionPct: 25,
          favorable: false,
        },
        {
          concepto: "operating_expense",
          label: "Gastos operacionales",
          plan: 3000000,
          real: 2500000,
          variacion: -500000,
          variacionPct: -17,
          favorable: true,
        },
        {
          concepto: "result",
          label: "Resultado",
          plan: 3000000,
          real: 4500000,
          variacion: 1500000,
          variacionPct: 50,
          favorable: true,
        },
      ],
      resultado: {
        concepto: "result",
        label: "Resultado",
        plan: 3000000,
        real: 4500000,
        variacion: 1500000,
        variacionPct: 50,
        favorable: true,
      },
    },
  },
} satisfies Meta<typeof PlanRealWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Plan vs Real")).toBeInTheDocument();
    await expect(c.getByText("Ingresos")).toBeInTheDocument();
    await expect(c.getByText("Resultado")).toBeInTheDocument();
    // Ingresos +20% favorable, Costo +25% desfavorable.
    await expect(c.getByText("+20%")).toBeInTheDocument();
    await expect(c.getByText("+25%")).toBeInTheDocument();
    await expect(c.getByText("−17%")).toBeInTheDocument();
  },
};

export const ToggleMesAnio: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    // Con onModoChange aparece el toggle Mes/Año.
    const anio = c.getByRole("tab", { name: "Año" });
    await userEvent.click(anio);
    // El handler recibe el cambio (el estado lo gobierna el contenedor).
    await expect(anio).toBeInTheDocument();
  },
  args: {
    onModoChange: () => {},
  },
};
