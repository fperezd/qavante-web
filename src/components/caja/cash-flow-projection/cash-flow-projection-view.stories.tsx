import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CashFlowProjectionView } from "./cash-flow-projection-view";
import {
  proyeccionConQuiebre,
  proyeccionSana,
  proyeccionSinMinimo,
} from "./cash-flow-projection-fixtures";

/* PROPUESTA UX — Proyección de Caja v2 (`/caja/proyeccion`).
   Agrega saldo acumulado (¿dónde cruzo cero?), línea de caja mínima y marcado
   del quiebre. Insumos ya disponibles (CashToday + netos del reporte + cash-minimum). */

const meta = {
  title: "Propuestas / Caja / Proyección v2",
  component: CashFlowProjectionView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CashFlowProjectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Caja sana: la curva baja y se recupera, nunca cruza el mínimo. */
export const Sana: Story = { args: { data: proyeccionSana } };

/** Con quiebre: la curva cruza bajo la caja mínima → banner rojo + fila y período marcados. */
export const ConQuiebre: Story = { args: { data: proyeccionConQuiebre } };

/** Sin caja mínima definida: curva sin umbral ni quiebre. */
export const SinMinimo: Story = { args: { data: proyeccionSinMinimo } };
