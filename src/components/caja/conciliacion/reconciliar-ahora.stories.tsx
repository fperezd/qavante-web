import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { ReconciliarAhora } from "./reconciliar-ahora";
import { resumenReconcile } from "./reconciliacion-cola-map";

const cero = {
  matched: 0,
  consolidated: 0,
  review: 0,
  excluded: 0,
  ambiguous: 0,
  no_candidate: 0,
  iva_retention: 0,
  nc_netting: 0,
  holding: 0,
  prepago_applied: 0,
  processor_batch: 0,
};

const meta = {
  title: "Capa 2 / Caja / Conciliación / ReconciliarAhora",
  component: ReconciliarAhora,
  parameters: { layout: "padded" },
  args: { onReconciliar: fn(), corriendo: false, ultimoResumen: null },
} satisfies Meta<typeof ReconciliarAhora>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Estado inicial: explica qué hace, sin resultado todavía. */
export const SinCorrerAun: Story = {};

/** Corriendo: el botón muestra el spinner. */
export const Corriendo: Story = {
  args: { corriendo: true },
};

/** Después de correr: muestra el resumen de dueño de la última corrida. */
export const ConResultado: Story = {
  args: { ultimoResumen: resumenReconcile({ ...cero, matched: 10, review: 5 }) },
};

/** El clic dispara onReconciliar. */
export const Dispara: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: /Conciliar ahora/i }));
    await expect(args.onReconciliar).toHaveBeenCalled();
  },
};
