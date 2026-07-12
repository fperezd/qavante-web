import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { BrechaPlan } from "./brecha-plan";

/* El Plan de cierre de brecha demuestra si las acciones alcanzan a cubrir el
   faltante: cada una con impacto, estado y brecha restante corriendo, y el pie
   separando lo identificado de lo asegurado ("$0 si se aprueba", no "$0"). */

const meta = {
  title: "Inicio v2 / BrechaPlan",
  component: BrechaPlan,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Plan cuantificado para cerrar la brecha de caja. La certeza sale del comportamiento de pago (banco + SII), nunca de compromisos cargados a mano. El pie distingue cobertura identificada de lo aún sin asegurar.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 460 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    brechaTotal: 9_956_127,
    coberturaIdentificada: 9_100_000,
    pendienteAsegurar: 860_000,
    acciones: [
      {
        titulo: "Cobrar a clientes que pagan a tiempo",
        impacto: 7_800_000,
        fecha: "7 días",
        estado: "probable",
        brechaRestante: -2_160_000,
      },
      {
        titulo: "Reprogramar pagos negociables (proveedores)",
        impacto: 1_300_000,
        fecha: "10 días",
        estado: "en_negociacion",
        brechaRestante: -860_000,
      },
      {
        titulo: "Evaluar cobertura financiera (línea / factoring)",
        impacto: 860_000,
        fecha: "14 días",
        estado: "por_evaluar",
        brechaRestante: 0,
        restanteNota: "si se aprueba",
      },
    ],
  },
} satisfies Meta<typeof BrechaPlan>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crisis: Story = {};

export const CasiResuelta: Story = {
  name: "Brecha casi cerrada",
  args: {
    pendienteAsegurar: 0,
    acciones: [
      {
        titulo: "Cobrar a clientes que pagan a tiempo",
        impacto: 8_500_000,
        fecha: "7 días",
        estado: "probable",
        brechaRestante: -1_456_127,
      },
      {
        titulo: "Reprogramar pagos negociables (proveedores)",
        impacto: 1_456_127,
        fecha: "10 días",
        estado: "confirmada",
        brechaRestante: 0,
      },
    ],
  },
};

export const Interaccion: Story = {
  name: "Muestra estados y brecha restante",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El estado honesto aparece (no "certeza"): la 3ª acción está "Por evaluar".
    await expect(canvas.getByText("Por evaluar")).toBeInTheDocument();
    await expect(canvas.getByText("En negociación")).toBeInTheDocument();
    // El cierre condicional no se presenta como resuelto: "$0" lleva la nota.
    await expect(canvas.getByText("si se aprueba")).toBeInTheDocument();
    // El pie separa identificada de pendiente.
    await expect(canvas.getByText(/Pendiente de asegurar/)).toBeInTheDocument();
  },
};
