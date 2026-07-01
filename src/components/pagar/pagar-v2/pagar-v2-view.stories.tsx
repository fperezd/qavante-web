import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PagarV2View } from "./pagar-v2-view";
import { pagarApretado, pagarHolgado } from "./pagar-v2-fixtures";

/* PROPUESTA UX — Pagar v2 (`/pagar`).
   De listado plano a herramienta de decisión: bucket Vencido, subtotales por
   criticidad, delta de caja explícito y agrupación por proveedor.
   Usa el toggle "Ver por: Vencimiento / Proveedor". */

const meta = {
  title: "Propuestas / Pagar / Pagar v2",
  component: PagarV2View,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PagarV2View>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Caja apretada: hay vencidos y la caja NO cubre lo crítico → banner rojo. */
export const Apretado: Story = { args: { data: pagarApretado } };

/** Caja holgada: sin vencidos, cubre lo crítico. */
export const Holgado: Story = { args: { data: pagarHolgado } };
