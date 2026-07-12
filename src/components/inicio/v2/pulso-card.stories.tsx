import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { PulsoCard } from "./pulso-card";

/* El Pulso (marca) con anillo centrado, factores como chips y la tendencia de 30
   días abajo — el score deja de ser un número suelto. */

const BAJANDO = [58, 55, 57, 52, 49, 50, 45, 42, 40, 37, 35, 34, 33];
const SUBIENDO = [71, 70, 73, 72, 75, 74, 77, 79, 80, 82, 83, 84];

const meta = {
  title: "Inicio v2 / PulsoCard",
  component: PulsoCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          '"Pulso del negocio" (término de marca — no se renombra). Confianza de los datos + factores + tendencia de 30 días (serie del snapshot q_score, ADR-0064).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PulsoCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Critica: Story = {
  args: {
    score: 33,
    status: "critical",
    confianza: "Confianza de los datos: alta",
    tendencia: BAJANDO,
    delta: "▼ de 58 a 33 en 30 días",
    factores: [
      { label: "Días de caja: 0", tono: "crit" },
      { label: "Cobertura de pagos: parcial", tono: "crit" },
      { label: "Vencido: $0", tono: "ok" },
      { label: "Vencimientos concentrados", tono: "warn" },
    ],
  },
};

export const Sana: Story = {
  args: {
    score: 84,
    status: "stable",
    confianza: "Confianza de los datos: alta",
    tendencia: SUBIENDO,
    delta: "▲ de 71 a 84 en 30 días",
    factores: [
      { label: "Días de caja: 96", tono: "ok" },
      { label: "Cobertura de pagos: 100%", tono: "ok" },
      { label: "Vencido: $0", tono: "ok" },
      { label: "Márgenes al alza", tono: "ok" },
    ],
  },
};

export const Interaccion: Story = {
  name: "Marca + confianza + tendencia",
  args: { ...Critica.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pulso del negocio")).toBeInTheDocument();
    await expect(canvas.getByText(/Confianza de los datos/)).toBeInTheDocument();
    await expect(canvas.getByText(/de 58 a 33/)).toBeInTheDocument();
  },
};
