import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingShell } from "./onboarding-shell";

/* Shell del wizard de onboarding (ADR-0017). Barra de progreso + "Paso N de 7"
   + título del paso + slot de contenido. Presentacional: recibe el `step`
   activo. Gated por el flag `onboarding` (OFF en prod). */

const Placeholder = () => (
  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-neutral-mid">
    Contenido del paso (placeholder de la fundación — Fase 1).
  </div>
);

const meta = {
  title: "Capa 2 / Onboarding / OnboardingShell",
  component: OnboardingShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OnboardingShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrimerPaso: Story = {
  name: "Paso 1 — Crear cuenta",
  args: {
    step: "signup",
    description: "Empieza creando tu cuenta y la empresa que vas a gestionar.",
    children: <Placeholder />,
  },
};

export const PasoIntermedio: Story = {
  name: "Paso 3 — Conectar SII",
  args: {
    step: "connect-sii",
    description: "Conecta el SII para traer tus documentos tributarios.",
    children: <Placeholder />,
  },
};

export const UltimoPaso: Story = {
  name: "Paso 7 — Traer datos",
  args: {
    step: "import",
    description: "Estamos trayendo tus datos para dejar todo listo.",
    children: <Placeholder />,
  },
};
