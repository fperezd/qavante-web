import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CajaCockpitView } from "./caja-cockpit-view";
import {
  cajaAjustada,
  cajaDesactualizada,
  cajaEnRiesgo,
  cajaSana,
} from "./caja-cockpit-fixtures";

/* PROPUESTA UX — Cockpit de Caja para el home `/caja`.
   Convierte el menú de links actual en un tablero: Saldo hoy · Runway · Alerta
   de quiebre · Saldo por cuenta. Datos ya expuestos por el backend (CashToday/
   CashForecast/CashGap + bank-accounts). */

const meta = {
  title: "Propuestas / Caja / Cockpit de Caja",
  component: CajaCockpitView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaCockpitView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Caja sana: runway holgado, sin alerta. */
export const Sana: Story = { args: { data: cajaSana } };

/** Quiebre de caja: banner rojo + runway crítico + holgura negativa. */
export const EnRiesgo: Story = { args: { data: cajaEnRiesgo } };

/** Runway ajustado (amarillo) sin quiebre declarado. */
export const Ajustada: Story = { args: { data: cajaAjustada } };

/** Datos desactualizados / sin proyección: degrada honesto. */
export const Desactualizada: Story = { args: { data: cajaDesactualizada } };
