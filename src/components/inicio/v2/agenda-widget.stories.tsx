import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { AgendaWidget } from "./agenda-widget";
import type { GrupoAgenda } from "./agenda-model";

/* AgendaWidget — los cobros y pagos de las próximas 2 semanas, por semana. */

const GRUPOS: GrupoAgenda[] = [
  {
    titulo: "Esta semana",
    rango: "8–14 ago",
    items: [
      {
        fecha: new Date(2026, 7, 8),
        fechaLabel: "8-ago",
        label: "Sueldos e imposiciones",
        monto: -2600000,
        tipo: "sueldos",
      },
      {
        fecha: new Date(2026, 7, 11),
        fechaLabel: "11-ago",
        label: "Cobro Comercial Kaufmann",
        monto: 2840000,
        tipo: "cobranza",
      },
    ],
  },
  {
    titulo: "Próxima semana",
    rango: "15–21 ago",
    items: [
      {
        fecha: new Date(2026, 7, 20),
        fechaLabel: "20-ago",
        label: "IVA — F29 de julio",
        monto: -210000,
        tipo: "impuesto",
      },
    ],
  },
];

const meta = {
  title: "Propuestas / Inicio v2 / AgendaWidget",
  component: AgendaWidget,
  parameters: { layout: "padded" },
  args: { grupos: GRUPOS, cobros: 2840000, pagos: 2810000 },
} satisfies Meta<typeof AgendaWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConVencimientos: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Próximas 2 semanas")).toBeInTheDocument();
    // Las dos semanas con sus rangos.
    await expect(c.getByText("Esta semana")).toBeInTheDocument();
    await expect(c.getByText(/8–14 ago/)).toBeInTheDocument();
    await expect(c.getByText("Próxima semana")).toBeInTheDocument();
    // Un cobro (verde con +) y un pago (rojo con −).
    await expect(c.getByText("Cobro Comercial Kaufmann")).toBeInTheDocument();
    await expect(c.getByText(/\+\$2\.840\.000/)).toBeInTheDocument();
    await expect(c.getByText(/−\$2\.600\.000/)).toBeInTheDocument();
  },
};

export const Vacio: Story = {
  args: {
    grupos: [
      { titulo: "Esta semana", rango: "8–14 ago", items: [] },
      { titulo: "Próxima semana", rango: "15–21 ago", items: [] },
    ],
    cobros: 0,
    pagos: 0,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/Nada por cobrar ni pagar/)).toBeInTheDocument();
  },
};
