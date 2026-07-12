import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { AccionesList } from "./acciones-list";

/* Lista de acciones para sana / control de gestión: verbos ordenados por impacto,
   con dato del SII + banco. En control, un pin fija la continuidad (baranda). */

const meta = {
  title: "Inicio v2 / AccionesList",
  component: AccionesList,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Acciones para escenarios sin brecha (sana / control). En crisis se usa BrechaPlan. El pin fija la continuidad abajo cuando el lente prioriza rentabilidad.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccionesList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crecer: Story = {
  args: {
    titulo: "Qué hacer para crecer",
    acciones: [
      {
        rank: 1,
        titulo: "Las ventas crecen +18% mes a mes",
        detalle: "Conviene sostener la caja para financiar el crecimiento (tendencia del SII)",
        plazo: "Seguimiento",
        cta: "Ver ventas →",
      },
      {
        rank: 2,
        titulo: "Excedente estimado sobre el colchón operativo",
        detalle: "$22,0M — evaluar alternativas: reserva · prepagar deuda · crecimiento · invertir",
        plazo: "Trimestre",
        cta: "Ver alternativas →",
      },
      {
        rank: 3,
        titulo: "Un cliente concentra el 38% de las ventas",
        detalle: "Riesgo de dependencia (dato del SII)",
        plazo: "Estratégico",
        cta: "Ver concentración →",
      },
    ],
  },
};

export const ControlDeGestion: Story = {
  name: "Control de gestión (con pin de continuidad)",
  args: {
    titulo: "Análisis de gestión · con lo que tenemos",
    acciones: [
      {
        rank: 1,
        titulo: "Un cliente concentra el 38% de las ventas",
        detalle: "Ingreso expuesto: $3,4M/mes si ese cliente cae (dato del SII)",
        plazo: "Estructural",
        cta: "Ver concentración →",
      },
      {
        rank: 2,
        titulo: "Los servicios subieron 18% este mes",
        detalle: "Impacto estimado en el margen del mes: −$0,6M (clasificación del SII)",
        plazo: "Este mes",
        plazoTono: "warn",
        cta: "Ver costos →",
      },
      {
        rank: 3,
        titulo: "El ciclo de caja se alargó a 42 días",
        detalle: "Capital de trabajo inmovilizado: ~$4,1M (cobra a 42d, paga a 28d — conciliación)",
        plazo: "Seguimiento",
        cta: "Ver cobranza →",
      },
    ],
    pin: {
      texto: "⚠ Continuidad fijada — la empresa aún debe asegurar $9,96M a 14 días",
      cta: "Ver plan →",
    },
  },
};

export const Interaccion: Story = {
  name: "Baranda: continuidad fijada, no se oculta",
  args: { ...ControlDeGestion.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Continuidad fijada/)).toBeInTheDocument();
    await expect(canvas.getByText(/Ingreso expuesto/)).toBeInTheDocument();
  },
};
