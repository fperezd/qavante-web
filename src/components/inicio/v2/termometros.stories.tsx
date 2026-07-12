import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { Termometros } from "./termometros";

/* Las 3 preguntas del dueño en tercera persona. En crisis, continuidad destacada
   en rojo; las otras dos respondidas con dato del SII (sin anunciar carencias). */

const meta = {
  title: "Inicio v2 / Termometros",
  component: Termometros,
  parameters: {
    docs: {
      description: {
        component:
          "Las 3 preguntas (¿La caja cubre la operación? · ¿La empresa está ganando dinero? · ¿…ingresos futuros…?). Estado + respuesta con dato real. La continuidad puede quedar fijada (baranda).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1040 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Termometros>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crisis: Story = {
  args: {
    items: [
      {
        n: 1,
        pregunta: "¿La caja cubre la operación?",
        pill: "🔴 Crítico",
        pillTono: "crit",
        destacado: "crit",
        respuesta: "Debe asegurar $9,96M para los pagos de 14 días. Runway 0 días.",
        masLabel: "Ver plan ↓",
      },
      {
        n: 2,
        pregunta: "¿La empresa está ganando dinero?",
        pill: "🟢 Positivo",
        pillTono: "ok",
        respuesta:
          "Resultado +$7,9M este mes · margen 89% (preliminar). Costos y concentración de ventas bajo seguimiento.",
        masLabel: "Ver rentabilidad →",
      },
      {
        n: 3,
        pregunta: "¿La empresa tiene ingresos futuros para crecer sin tensionar la caja?",
        pill: "🟢 Estimado",
        pillTono: "ok",
        respuesta:
          "Estimados según la recurrencia observada: ingresos recurrentes, concentración de clientes y tendencia de ventas (SII).",
        masLabel: "Ver crecimiento →",
      },
    ],
  },
};

export const ControlDeGestion: Story = {
  name: "Lente control de gestión",
  args: {
    items: [
      {
        n: 2,
        pregunta: "¿La empresa está ganando dinero?",
        pill: "🟢 Positivo · foco",
        pillTono: "ok",
        destacado: "focus",
        respuesta:
          "Resultado +$7,9M · margen 89% (preliminar). Evolución de costos y concentración de ventas.",
        masLabel: "Ver rentabilidad →",
      },
      {
        n: 3,
        pregunta: "¿La empresa tiene ingresos futuros para crecer sin tensionar la caja?",
        pill: "🟢 Estimado",
        pillTono: "ok",
        respuesta: "Estimados según la recurrencia observada (SII).",
        masLabel: "Ver crecimiento →",
      },
      {
        n: 1,
        pregunta: "¿La caja cubre la operación?",
        pill: "🔴 Crítico · fijado",
        pillTono: "crit",
        destacado: "crit",
        respuesta:
          "Debe asegurar $9,96M a 14 días. No se oculta aunque se priorice la rentabilidad.",
        masLabel: "Ver plan →",
      },
    ],
  },
};

export const Interaccion: Story = {
  name: "Tercera persona, tono suave",
  args: { ...Crisis.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tono suave (NO "puede seguir operando") y tercera persona.
    await expect(canvas.getByText("¿La caja cubre la operación?")).toBeInTheDocument();
    await expect(canvas.getByText("¿La empresa está ganando dinero?")).toBeInTheDocument();
  },
};
