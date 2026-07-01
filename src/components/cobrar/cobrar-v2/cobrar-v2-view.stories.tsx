import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CobrarV2View } from "./cobrar-v2-view";
import { cobranzaConRiesgo, cobranzaSana } from "./cobrar-v2-fixtures";

/* PROPUESTA UX — Cobrar v2 (`/cobrar`).
   Suma DSO con tendencia, proyección de cobranza semanal (cash-in), priorización
   (saldo × días de mora) y concentración de cartera. */

const meta = {
  title: "Propuestas / Cobrar / Cobrar v2",
  component: CobrarV2View,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CobrarV2View>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Cartera con riesgo: DSO subiendo (52 vs 45, meta 30), 32% vencido, concentración alta. */
export const ConRiesgo: Story = { args: { data: cobranzaConRiesgo } };

/** Cartera sana: DSO mejorando, poco vencido. */
export const Sana: Story = { args: { data: cobranzaSana } };
