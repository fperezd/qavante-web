import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PayrollSyncBar } from "./payroll-sync-bar";

/* PayrollSyncBar — registra la planilla del período como obligación en Pagar
   (ADR-0056) + configura el día de pago. Presentacional. */

const meta = {
  title: "Capa 2 / Remuneraciones / PayrollSyncBar",
  component: PayrollSyncBar,
  parameters: { layout: "padded" },
  args: { onSync: fn(), onSavePayday: fn(), paydayRule: "último día hábil" },
} satisfies Meta<typeof PayrollSyncBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const DiaFijo: Story = {
  name: "Día de pago fijo",
  args: { paydayRule: "día 5", paydayDay: 5 },
};

export const Sincronizando: Story = {
  args: { syncing: true },
};

export const Registrado: Story = {
  name: "Registrado en Pagar (éxito)",
  args: { syncResult: { total_liquido: 14330000 } },
};

export const ConError: Story = {
  name: "Error de sync",
  args: { syncError: new globalThis.Error("No pudimos registrar la planilla en Pagar.") },
};
