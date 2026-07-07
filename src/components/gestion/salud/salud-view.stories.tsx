import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SaludView } from "./salud-view";
import { saludApreton, saludSolida, saludCrisis } from "./salud-fixtures";

/* PROTOTIPO UX (no cableado a rutas). Pantalla "Salud": los dos instrumentos de
   Qavante juntos — PULSO (caja del mes, diario) + Health Score (fondo, mensual)
   — con matriz de lectura conjunta, drivers con evidencia, semáforo de
   decisiones y confianza del dato. Vocabulario según §8 del diccionario de UI.
   Ver ADR-0064 + spec pulso-y-health-score-spec-v1. */

const meta = {
  title: "Propuestas / Gestión / Salud",
  component: SaludView,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Prototipo de la pantalla Salud (ADR-0064). Presentacional puro: PULSO + Health Score, matriz PULSO×QHS, drivers en lenguaje de dueño de pyme, semáforo de decisiones y confianza del dato. Reutiliza PulsoRing y las primitivas Qavante. No cableado a rutas — cero impacto en prod.",
      },
    },
  },
} satisfies Meta<typeof SaludView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empresa sana con la caja apretada (escenario central del diseño). */
export const Apreton: Story = {
  name: "Apretón pasajero",
  args: { model: saludApreton },
};

/** Caja holgada y salud alta: para crecer e invertir. */
export const Solida: Story = {
  name: "Empresa sólida",
  args: { model: saludSolida },
};

/** Caja y estructura comprometidas a la vez. */
export const Crisis: Story = {
  name: "Crisis de caja",
  args: { model: saludCrisis },
};
