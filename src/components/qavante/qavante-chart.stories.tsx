import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  QavanteAreaChart,
  QavanteBarChart,
  QavanteLineChart,
  type QavanteChartProps,
} from "./qavante-chart";

/* Datos de muestra agnósticos (no dominio). */
const data = [
  { mes: "Ene", ingresos: 120, costos: 80 },
  { mes: "Feb", ingresos: 145, costos: 90 },
  { mes: "Mar", ingresos: 132, costos: 88 },
  { mes: "Abr", ingresos: 168, costos: 102 },
  { mes: "May", ingresos: 190, costos: 110 },
  { mes: "Jun", ingresos: 175, costos: 105 },
];

const series = [
  { key: "ingresos", label: "Ingresos" },
  { key: "costos", label: "Costos" },
];

const args: QavanteChartProps = { data, index: "mes", series, height: 260 };

const meta = {
  title: "Capa 1 / Charts",
  component: QavanteAreaChart,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Wrappers tematizados sobre recharts (Area/Bar/Line). Paleta de marca desde tokens, ejes sutiles, grilla mínima y tooltip con el `valueFormatter` del consumidor. Datos genéricos.",
      },
    },
  },
  args,
} satisfies Meta<typeof QavanteAreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Area: Story = {
  render: (a) => <QavanteAreaChart {...a} />,
};

export const Barras: Story = {
  render: (a) => <QavanteBarChart {...a} />,
};

export const Lineas: Story = {
  render: (a) => <QavanteLineChart {...a} />,
};

export const ConFormatoMoneda: Story = {
  args: {
    valueFormatter: (v: number) => `$${v.toLocaleString("es-CL")}`,
  },
  render: (a) => <QavanteAreaChart {...a} />,
};
